import { NextResponse, type NextRequest } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function jsonReject(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function hostOf(value: string): string | null {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Cross-site request forgery defence.
 *
 * Session cookies are already SameSite=Lax, but every state-changing API call
 * also has to come from this exact host. Browsers always send Origin for
 * cross-origin POST/PATCH/DELETE requests, so a mismatch is rejected. Requests
 * without Origin are allowed only when the browser did not mark them as
 * cross-site, which keeps curl and monitoring working.
 */
function isTrustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    const originHost = hostOf(origin);
    if (!originHost || originHost !== request.nextUrl.host.toLowerCase()) {
      return false;
    }
  }
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    return false;
  }
  return true;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Encoded traversal segments should never reach a route handler.
  const lowerPath = pathname.toLowerCase();
  if (
    lowerPath.includes("..") ||
    lowerPath.includes("%2e") ||
    lowerPath.includes("\\")
  ) {
    return jsonReject("Not found.", 404);
  }

  // Request smuggling: a request must not carry both framing headers.
  if (
    request.headers.has("content-length") &&
    request.headers.has("transfer-encoding")
  ) {
    return jsonReject("Bad request.", 400);
  }

  if (MUTATING_METHODS.has(request.method) && !isTrustedOrigin(request)) {
    return jsonReject("Cross-site request blocked.", 403);
  }

  const response = NextResponse.next();

  // Never expose a permissive CORS policy. Same-origin only.
  response.headers.delete("access-control-allow-origin");
  response.headers.delete("access-control-allow-credentials");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Vary", "Origin, Cookie");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
