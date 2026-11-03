import { NextResponse } from "next/server";
import { googleMapsApiKey } from "@/lib/google-maps-key";

type ReverseResult = {
  address: string;
  village: string;
  pincode: string;
  district: string;
  state: string;
  provider: "google" | "openstreetmap";
};

type GoogleComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GoogleGeocodeResponse = {
  status: string;
  results?: Array<{
    formatted_address?: string;
    address_components?: GoogleComponent[];
  }>;
};

type NominatimResponse = {
  display_name?: string;
  address?: Record<string, string>;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 500;
const cache = new Map<string, { expires: number; data: ReverseResult }>();

function cacheKey(lat: number, lng: number) {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function readCache(lat: number, lng: number): ReverseResult | null {
  const entry = cache.get(cacheKey(lat, lng));
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    cache.delete(cacheKey(lat, lng));
    return null;
  }
  return entry.data;
}

function writeCache(lat: number, lng: number, data: ReverseResult) {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(cacheKey(lat, lng), {
    expires: Date.now() + CACHE_TTL_MS,
    data,
  });
}

function googleKey(): string {
  return (
    process.env.GOOGLE_GEOCODING_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    googleMapsApiKey()
  );
}

function componentOf(
  components: GoogleComponent[],
  ...types: string[]
): string {
  for (const type of types) {
    const found = components.find((component) => component.types.includes(type));
    if (found?.long_name) return found.long_name;
  }
  return "";
}

async function reverseWithGoogle(
  lat: number,
  lng: number,
): Promise<ReverseResult | null> {
  const key = googleKey();
  if (!key) return null;
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set("key", key);
    url.searchParams.set("language", "en");
    url.searchParams.set("region", "in");
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as GoogleGeocodeResponse;
    const result = data.results?.[0];
    if (data.status !== "OK" || !result) return null;

    const components = result.address_components ?? [];
    const village = componentOf(
      components,
      "sublocality_level_2",
      "sublocality_level_1",
      "sublocality",
      "locality",
      "administrative_area_level_3",
      "postal_town",
      "neighborhood",
    );
    const district = componentOf(
      components,
      "administrative_area_level_2",
      "administrative_area_level_3",
      "locality",
    );
    const state = componentOf(components, "administrative_area_level_1");
    const pincode = componentOf(components, "postal_code");
    const address =
      result.formatted_address ||
      [village, district, state, pincode].filter(Boolean).join(", ");

    if (!address) return null;
    return {
      address,
      village,
      pincode,
      district,
      state,
      provider: "google",
    };
  } catch (error) {
    console.warn("[geo/reverse] Google geocoding failed:", error);
    return null;
  }
}

async function reverseWithNominatim(
  lat: number,
  lng: number,
): Promise<ReverseResult | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("zoom", "18");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    const response = await fetch(url, {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "KisanTractor/1.0 (https://kisantractor.app)",
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as NominatimResponse;
    const addr = data.address ?? {};
    const village =
      addr.village ||
      addr.hamlet ||
      addr.suburb ||
      addr.neighbourhood ||
      addr.town ||
      addr.municipality ||
      addr.city ||
      "";
    const district =
      addr.state_district ||
      addr.county ||
      addr.city_district ||
      addr.city ||
      "";
    const state = addr.state || "";
    const pincode = addr.postcode || "";
    const address =
      data.display_name ||
      [village, district, state, pincode].filter(Boolean).join(", ");
    if (!address) return null;
    return {
      address,
      village,
      pincode,
      district,
      state,
      provider: "openstreetmap",
    };
  } catch (error) {
    console.warn("[geo/reverse] OpenStreetMap geocoding failed:", error);
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return NextResponse.json(
      { error: "Send a valid latitude and longitude." },
      { status: 400 },
    );
  }

  const cached = readCache(lat, lng);
  if (cached) {
    return NextResponse.json({ ok: true, ...cached, cached: true });
  }

  const result =
    (await reverseWithGoogle(lat, lng)) ??
    (await reverseWithNominatim(lat, lng));

  if (!result) {
    return NextResponse.json(
      { error: "Could not find an address for these coordinates." },
      { status: 502 },
    );
  }

  writeCache(lat, lng, result);
  return NextResponse.json({ ok: true, ...result });
}
