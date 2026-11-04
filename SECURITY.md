# Security review — KisanTractor

This document maps the OWASP-style checklist used for this review to the
controls in the codebase. It is a living record: update it whenever an API
route, upload path, or auth flow changes.

## Request and browser hardening

| # | Area | Status | Control |
|---|------|--------|---------|
| 1 | SQL injection | Pass | No raw SQL is built from user input. All persistence goes through the Supabase query builder (`app_state`) or the local JSON store, both parameterised. |
| 2 | Cross-site scripting (XSS) | Pass | React escapes rendered values. The only HTML string sinks are Leaflet/Google popups; every interpolated value passes `escapeHtml`. No `dangerouslySetInnerHTML`, `eval`, or `new Function`. |
| 3 | CSRF | Pass | Session cookie is `HttpOnly`, `SameSite=Lax`, `Secure` in production. `src/proxy.ts` rejects mutating `/api` requests whose `Origin`/`Sec-Fetch-Site` is not this host. |
| 4 | Clickjacking | Pass | `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`. |
| 5 | DOM-based vulnerabilities | Pass | No DOM HTML injection from URL data. Map popups are escaped; `javascript:` URLs are rejected for stored image fields. |
| 6 | CORS | Pass | No `Access-Control-Allow-Origin` is emitted. The proxy deletes any inherited CORS headers, so only same-origin browser calls succeed. |
| 7 | XXE | Not applicable | No XML parsing anywhere in the app. |
| 8 | SSRF | Pass | The only outbound calls use fixed hosts (Google Geocoding, Nominatim). Coordinates are range-checked; users cannot supply a URL. |
| 9 | HTTP request smuggling | Pass | Hosting/proxy terminates HTTP. `src/proxy.ts` rejects requests carrying both `Content-Length` and `Transfer-Encoding`. |
| 10 | OS command injection | Not applicable | No `child_process`, shell, or command execution. |
| 11 | SSTI | Not applicable | No template engine evaluates user input. |
| 12 | Path traversal | Pass | Upload names are server-generated UUIDs. Private file names must match `^[A-Za-z0-9][A-Za-z0-9._-]*$`; `..`, `/`, and backslashes are rejected by the proxy and route. |
| 13 | Access control | Pass | Every mutating route calls `requireUser` and re-checks role/ownership in the service layer. Bookings are readable only by their two parties. Private documents are readable only by the owning account; unknown names return 404. Public tractor listings no longer expose owner phone, payment, or document data. |
| 14 | Authentication | Pass | Supabase phone OTP in production. Test OTP is off by default in production; when `AUTH_DEV_OTP=true` it is limited to the numbers in `AUTH_DEV_OTP_PHONES` (if set) and should be disabled after testing. OTPs are consumed after use and compared with `timingSafeEqual`. Signed `kt_session` cookie with HMAC-SHA256. Production refuses to start sessions without `SESSION_SECRET`. |
| 15 | WebSockets | Not applicable | The app does not open WebSocket servers. Next.js dev HMR is local-only. |
| 16 | Web cache poisoning | Pass | API responses are `Cache-Control: no-store`, `Vary: Origin, Cookie`; no user input is reflected into cache keys or headers. |
| 17 | Insecure deserialization | Pass | Only `JSON.parse` of request bodies and the app-state document. Parsed bodies reject `__proto__`, `prototype`, and `constructor` keys. No native serialization gadgets. |
| 18 | Information disclosure | Pass | Generic 500 responses; internal errors only logged server-side. Phone numbers suppressed in public listings. Account name returned only after the caller supplies the matching name. Uploaded documents served with `no-store`, `nosniff`, and a sandbox CSP. |
| 19 | Basic login vulnerabilities | Pass | OTP request limited to 10/IP and 3/phone per 10 minutes; verification limited to 20/IP and 8/phone per 10 minutes. Identity mismatch uses the required exact message. Logout clears the session. |
| 20 | HTTP Host header attacks | Pass | Origin must match the request host for state changes. No absolute links are generated from the `Host` header. |
| 21 | OAuth | Not applicable | No OAuth provider is configured. |
| 22 | File upload | Pass | JPG/PNG/WebP/AVIF only; MIME allowlist plus magic-byte check; 10 MB cap; UUID names; raster only (no SVG/HTML); documents private. |
| 23 | JWT | Pass | No third-party JWT. The custom token is HMAC-SHA256 signed, expiry-checked, and compared with `timingSafeEqual`. The unsigned legacy session fallback was removed. |
| 24 | VAPT skills | Pass | Checklist applied across routes, headers, auth, uploads, access control, and cache behaviour. Run `npx tsc --noEmit`, `npm run lint`, `npm run build` before release. |
| 25 | Prototype pollution | Pass | `readJson` scans the whole body (depth-limited) and rejects dangerous keys. User-controlled image fields are validated and capped. |
| 26 | GraphQL | Not applicable | No GraphQL endpoint. |
| 27 | Race conditions | Pass | `app_state` writes use optimistic version checks with retries. Booking actions re-read and re-check status inside the write transaction. OTP challenges are consumed atomically. |
| 28 | NoSQL injection | Pass | Supabase filters receive typed values; no object operators are accepted from request bodies. |
| 29 | API testing | Pass | All routes were reviewed; mutating routes require auth, validate types, cap text lengths, and range-check numbers. Sensitive routes are rate-limited. |
| 30 | Web LLM attacks | Not applicable | No LLM or prompt-driven feature is exposed. |
| 31 | Web cache deception | Pass | API routes are never cached; private files use `no-store`; the proxy sets `X-Robots-Tag` and `Vary` on API responses. |

## Security headers

Set in `next.config.ts` for every response:

- Content-Security-Policy (same-origin default, no framing, no objects)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy (camera/geolocation self-only)
- Cross-Origin-Opener-Policy / Cross-Origin-Resource-Policy
- Strict-Transport-Security in production
- Cache-Control: no-store on `/api/*`

## Google Maps

Google Maps is opt-in. Default rendering is OpenStreetMap/Leaflet, so a key
that is blocked or has no billing enabled never emits
`ApiTargetBlockedMapError` during normal use.

To enable Google Maps:

1. In Google Cloud Console, enable **Maps JavaScript API** and **billing** for
   the key's project.
2. Set HTTP referrer restrictions for the production domain and `localhost`.
3. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_MAPS_PROVIDER=google`.
4. Redeploy (the `NEXT_PUBLIC_*` values are baked in at build time).

If Google still rejects the key, both map components detect the failure and
fall back to OpenStreetMap automatically.

The server-side reverse geocoder also falls back to Nominatim and pauses Google
for 10 minutes after a `REQUEST_DENIED`, so a misconfigured key does not add
latency to every address lookup.

## Test OTP mode

For testing a deployment where SMS cannot be delivered, set `AUTH_DEV_OTP=true`.
The API then returns the OTP in its response and the sign-in screen shows it with
an autofill button. To keep SMS working for real users, also set
`AUTH_DEV_OTP_PHONES` to a comma-separated list of the 10-digit numbers allowed to
use the test OTP, for example `AUTH_DEV_OTP_PHONES=9876543210,9123456789`.

The test OTP path is local to this app, consumes the challenge after use, and is
still covered by the OTP rate limits. It is an explicit testing aid: set
`AUTH_DEV_OTP=false` (or remove the variable) before a public launch so only
Supabase SMS OTPs can sign users in.

## Required production secrets

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET` (must be a long random value; startup fails closed without it)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (preferred for Auth; service role is a fallback)
- Google keys only if Google Maps/Geocoding is enabled

Never commit `.env`, `.env.local`, service-role keys, or session secrets.
