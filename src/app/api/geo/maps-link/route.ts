import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { googleMapsCoords } from "@/lib/utils";

/**
 * Resolve a Google Maps share link (including maps.app.goo.gl short links) to
 * coordinates. Google Maps cannot hand a picked point back to the app, so the
 * only reliable hand-off is the share link. Short links contain no coordinates
 * themselves, so the redirect chain has to be followed on the server.
 */

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 300;
const cache = new Map<string, { expires: number; coords: { lat: number; lng: number } }>();

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "goo.gl" || host === "maps.app.goo.gl") return true;
  // Google Maps links live on google.com or a regional google.<tld> domain.
  return /(^|\.)google\.[a-z.]{2,7}$/.test(host);
}

function validCoords(
  coords: { lat: number; lng: number } | null,
): { lat: number; lng: number } | null {
  if (!coords) return null;
  if (
    !Number.isFinite(coords.lat) ||
    !Number.isFinite(coords.lng) ||
    coords.lat < -90 ||
    coords.lat > 90 ||
    coords.lng < -180 ||
    coords.lng > 180
  ) {
    return null;
  }
  return coords;
}

/** Coordinates embedded in the HTML body use explicit decimal formats. */
function coordsFromBody(text: string): { lat: number; lng: number } | null {
  const patterns = [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /"center":\[(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)\]/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const coords = validCoords({
      lat: Number(match[1]),
      lng: Number(match[2]),
    });
    if (coords) return coords;
  }
  return null;
}

async function resolveMapsLink(start: URL): Promise<{ lat: number; lng: number } | null> {
  let current = start;
  for (let hop = 0; hop < 6; hop += 1) {
    if (!isAllowedHost(current.hostname)) return null;

    const direct = validCoords(googleMapsCoords(current.href));
    if (direct) return direct;

    const response = await fetch(current, {
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36",
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      current = new URL(location, current);
      continue;
    }

    if (!response.ok) return null;
    const body = (await response.text()).slice(0, 250_000);
    return coordsFromBody(body);
  }
  return null;
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "geo-maps-link", 30, 60 * 60 * 1000);
  if (limited) return limited;

  const body = await readJson<{ url?: string }>(request);
  const raw = typeof body.url === "string" ? body.url.trim() : "";
  if (!raw) return jsonError("Paste a Google Maps link.", 400);

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return jsonError("That is not a valid Google Maps link.", 400);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return jsonError("That is not a valid Google Maps link.", 400);
  }
  if (!isAllowedHost(parsed.hostname)) {
    return jsonError("Only Google Maps links are supported.", 400);
  }

  const direct = validCoords(googleMapsCoords(parsed.href));
  if (direct) return NextResponse.json({ coords: direct });

  const cached = cache.get(parsed.href);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({ coords: cached.coords });
  }

  try {
    const coords = await resolveMapsLink(parsed);
    if (!coords) {
      return jsonError(
        "We could not read a location from that link. In Google Maps, long-press the exact spot, tap Share → Copy link and paste it again.",
        422,
      );
    }
    if (cache.size >= CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(parsed.href, { expires: Date.now() + CACHE_TTL_MS, coords });
    return NextResponse.json({ coords });
  } catch {
    return jsonError(
      "We could not reach Google Maps. Check your connection and try again.",
      422,
    );
  }
}
