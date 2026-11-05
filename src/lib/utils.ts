import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function addDaysISO(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function formatDate(
  iso: string,
  locale = "en-IN",
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
  if (!iso) return "—";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, opts).format(date);
}

export function formatDateTime(iso: string, locale = "en-IN"): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(iso: string, locale = "en-IN"): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

export function relativeDay(iso: string, locale = "en-IN"): string {
  if (!iso) return "—";
  const today = todayISO();
  const tomorrow = addDaysISO(1);
  if (iso === today) return "Today";
  if (iso === tomorrow) return "Tomorrow";
  return formatDate(iso, locale, { day: "numeric", month: "short" });
}

export function maskMobile(mobile: string): string {
  const clean = mobile.replace(/\D/g, "").slice(-10);
  if (clean.length < 4) return mobile;
  return `+91 ••••• •${clean.slice(-4)}`;
}

export function mobileEnding(mobile: string): string {
  return mobile.replace(/\D/g, "").slice(-4);
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function computeActiveMinutes(
  segments: { start: string; end: string | null }[],
  now = new Date(),
): number {
  return segments.reduce((total, segment) => {
    const start = new Date(segment.start).getTime();
    const end = segment.end ? new Date(segment.end).getTime() : now.getTime();
    return total + Math.max(0, Math.round((end - start) / 60000));
  }, 0);
}

export function computeBreakMinutes(
  segments: { start: string; end: string | null }[],
  now = new Date(),
  isPaused = false,
): number {
  if (segments.length === 0) return 0;
  let total = 0;
  for (let i = 1; i < segments.length; i++) {
    const previousEnd = segments[i - 1].end
      ? new Date(segments[i - 1].end!).getTime()
      : null;
    const currentStart = new Date(segments[i].start).getTime();
    if (previousEnd !== null) {
      total += Math.max(0, Math.round((currentStart - previousEnd) / 60000));
    }
  }
  const last = segments[segments.length - 1];
  if (isPaused && last.end) {
    total += Math.max(
      0,
      Math.round((now.getTime() - new Date(last.end).getTime()) / 60000),
    );
  }
  return total;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ReverseGeocodeResult = {
  address: string;
  village: string;
  pincode: string;
  district: string;
  state: string;
  provider?: "google" | "openstreetmap" | "coordinates";
};

export function cleanPlaceName(val?: string | null): string {
  if (!val || typeof val !== "string") return "";
  let s = val.trim();
  // Strip Plus Code prefix (e.g. 8FW4V888+88, 7J4V+3Q, etc.)
  s = s.replace(/^[A-Z0-9]{2,8}\+[A-Z0-9]{2,4}\s*,?\s*/i, "").trim();
  if (/[A-Z0-9]{2,8}\+[A-Z0-9]{2,4}/i.test(s)) return "";
  if (/^unnamed\s*(road|street|path|lane|gali)?$/i.test(s)) return "";
  if (/^(nh|sh|ah|state highway|national highway)\s*[-–]?\s*\d+$/i.test(s)) return "";
  if (/^\d{3,8}$/.test(s)) return "";
  return s;
}

async function reverseWithOpenStreetMap(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`,
      { headers: { "Accept-Language": "en" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const addr = data.address || {};

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
        if (cleaned) {
          village = cleaned;
          break;
        }
      }
    }

    const district = cleanPlaceName(
      addr.state_district || addr.county || addr.district || addr.city_district || addr.city || "",
    );
    const state = cleanPlaceName(addr.state || "");
    const pincode = cleanPlaceName(addr.postcode || "");

    if (!village && data.display_name) {
      const parts = data.display_name.split(",").map((p) => cleanPlaceName(p)).filter(Boolean);
      for (const part of parts) {
        if (!/^(india|bharat)$/i.test(part) && part !== state && part !== district) {
          village = part;
          break;
        }
      }
    }

    let address = data.display_name || "";
    address = cleanPlaceName(address) || address;
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
  } catch {
    return null;
  }
}

/**
 * Resolve GPS coordinates to an Indian address. The server route uses Google
 * Geocoding when a key is configured and falls back to OpenStreetMap, so the
 * browser never depends on a single provider.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult> {
  try {
    const res = await fetch(
      `/api/geo/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
      { headers: { Accept: "application/json" } },
    );
    if (res.ok) {
      const data = (await res.json()) as Partial<ReverseGeocodeResult>;
      const result: ReverseGeocodeResult = {
        address: data.address ?? "",
        village: data.village ?? "",
        pincode: data.pincode ?? "",
        district: data.district ?? "",
        state: data.state ?? "",
        provider: data.provider,
      };
      if (result.address || result.village) return result;
    }
  } catch (err) {
    console.warn("Server reverse geocode failed, trying OpenStreetMap directly:", err);
  }

  const direct = await reverseWithOpenStreetMap(lat, lng);
  if (direct) return direct;

  return {
    address: `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    village: "",
    pincode: "",
    district: "",
    state: "",
    provider: "coordinates",
  };
}

/**
 * Extract a coordinate pair from anything a farmer may paste out of Google
 * Maps: a share link, a browser URL, or a plain "lat, lng" pair.
 */
export function googleMapsCoords(
  input: string,
): { lat: number; lng: number } | null {
  const value = input.trim();
  if (!value) return null;

  const patterns = [
    /@(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/,
    /[?&](?:q|query|ll|center|destination|daddr)=(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/i,
    /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
    /(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      return { lat, lng };
    }
  }
  return null;
}
