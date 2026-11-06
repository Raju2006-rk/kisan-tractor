import { NextResponse } from "next/server";
import { googleMapsApiKey } from "@/lib/google-maps-key";
import { enforceRateLimit } from "@/lib/rate-limit";

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
// When Google rejects the server key (API not enabled, billing missing, bad
// restriction) stop retrying it for a while and use OpenStreetMap directly.
let googleDisabledUntil = 0;

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

function cleanPincode(val?: string | null): string {
  if (!val || typeof val !== "string") return "";
  const digits = val.replace(/\D/g, "");
  if (digits.length >= 6) {
    return digits.slice(0, 6);
  }
  if (digits.length === 5) {
    return digits;
  }
  const match = val.match(/\b\d{6}\b/) || val.match(/\b\d{5}\b/);
  return match ? match[0] : "";
}

function cleanPlaceName(val?: string | null): string {
  if (!val || typeof val !== "string") return "";
  let s = val.trim();
  // Strip Plus Code prefix (e.g. 8FW4V888+88, 7J4V+3Q, etc.)
  s = s.replace(/^[A-Z0-9]{2,8}\+[A-Z0-9]{2,4}\s*,?\s*/i, "").trim();
  if (/^unnamed\s*(road|street|path|lane|gali)?$/i.test(s)) return "";
  if (/^(nh|sh|ah|state highway|national highway)\s*[-–]?\s*\d+$/i.test(s)) return "";
  return s;
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
  if (Date.now() < googleDisabledUntil) return null;
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
    if (data.status === "REQUEST_DENIED") {
      googleDisabledUntil = Date.now() + 10 * 60 * 1000;
      console.warn(
        "[geo/reverse] Google geocoding rejected the key; using OpenStreetMap for 10 minutes.",
      );
      return null;
    }
    const results = data.results ?? [];
    if (data.status !== "OK" || results.length === 0) return null;

    let locality = "";
    let sublocality1 = "";
    let admin3 = "";
    let sublocality = "";
    let neighborhood = "";
    let district = "";
    let state = "";
    let rawPincode = "";

    // Iterate through all Google results to find the most accurate settlement & administrative components
    for (const res of results) {
      const comps = res.address_components ?? [];
      if (!locality) locality = componentOf(comps, "locality");
      if (!sublocality1) sublocality1 = componentOf(comps, "sublocality_level_1");
      if (!admin3) admin3 = componentOf(comps, "administrative_area_level_3");
      if (!sublocality) sublocality = componentOf(comps, "sublocality");
      if (!neighborhood) neighborhood = componentOf(comps, "neighborhood");
      if (!district) district = componentOf(comps, "administrative_area_level_2", "administrative_area_level_3");
      if (!state) state = componentOf(comps, "administrative_area_level_1");
      if (!rawPincode) rawPincode = componentOf(comps, "postal_code");
    }

    // Priority for Indian settlement name: locality (town/city/village) > sublocality_level_1 > admin3 (taluka/tehsil) > sublocality
    const candidates = [locality, sublocality1, admin3, sublocality, neighborhood];
    let village = "";
    for (const cand of candidates) {
      const cleaned = cleanPlaceName(cand);
      if (cleaned && !/^\d+$/.test(cleaned)) {
        village = cleaned;
        break;
      }
    }

    const primaryResult = results[0];
    let formatted = primaryResult?.formatted_address || "";
    if (formatted) {
      formatted = formatted.replace(/^[A-Z0-9]{2,8}\+[A-Z0-9]{2,4}\s*,?\s*/i, "").trim();
    }

    district = cleanPlaceName(district);
    state = cleanPlaceName(state);
    const pincode =
      cleanPincode(rawPincode) ||
      (formatted.match(/\b\d{6}\b/) ? formatted.match(/\b\d{6}\b/)![0] : "");

    if (!village && formatted) {
      const parts = formatted.split(",").map((p) => cleanPlaceName(p)).filter(Boolean);
      for (const part of parts) {
        if (!/^(india|bharat)$/i.test(part) && part !== state && part !== district && !/^\d+$/.test(part)) {
          village = part;
          break;
        }
      }
    }

    const address = formatted || [village, district, state, pincode].filter(Boolean).join(", ");
    if (!address && !village) return null;

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

    // In India: priority order for village/settlement
    const candidates = [
      addr.village,
      addr.hamlet,
      addr.town,
      addr.subdistrict,
      addr.taluk,
      addr.tehsil,
      addr.mandal,
      addr.city,
      addr.neighbourhood,
      addr.suburb,
      addr.city_district,
      addr.residential,
    ];

    let village = "";
    for (const cand of candidates) {
      if (cand) {
        const cleaned = cleanPlaceName(cand);
        if (cleaned && !/^\d+$/.test(cleaned)) {
          village = cleaned;
          break;
        }
      }
    }

    const district = cleanPlaceName(
      addr.state_district ||
      addr.county ||
      addr.district ||
      addr.city_district ||
      addr.city ||
      "",
    );
    const state = cleanPlaceName(addr.state || "");
    let rawAddress = data.display_name || "";
    if (rawAddress) {
      rawAddress = rawAddress.replace(/^[A-Z0-9]{2,8}\+[A-Z0-9]{2,4}\s*,?\s*/i, "").trim();
    }
    const pincode =
      cleanPincode(addr.postcode) ||
      (rawAddress.match(/\b\d{6}\b/) ? rawAddress.match(/\b\d{6}\b/)![0] : "");

    if (!village && rawAddress) {
      const parts = rawAddress.split(",").map((p) => cleanPlaceName(p)).filter(Boolean);
      for (const part of parts) {
        if (!/^(india|bharat)$/i.test(part) && part !== state && part !== district && !/^\d+$/.test(part)) {
          village = part;
          break;
        }
      }
    }

    let address = rawAddress;
    if (!address) {
      address = [village, district, state, pincode].filter(Boolean).join(", ");
    }

    if (!address && !village) return null;
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
  const limited = enforceRateLimit(request, "geo-reverse", 60, 60 * 1000);
  if (limited) return limited;

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
