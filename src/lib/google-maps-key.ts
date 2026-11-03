/**
 * Browser key used by the Google Maps JavaScript API.
 *
 * The key is supplied through NEXT_PUBLIC_GOOGLE_MAPS_API_KEY so it is not
 * committed to the repository. Without a working key, or when Google rejects
 * the key, the map components automatically use the OpenStreetMap renderer.
 */
export function googleMapsApiKey(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim();
}

/**
 * Google Maps is opt-in.
 *
 * A blocked or unbilled Google Cloud key makes the JavaScript API log
 * `ApiTargetBlockedMapError` as soon as its script is requested. Because a key
 * cannot be verified at build time, the reliable default is OpenStreetMap.
 * Set NEXT_PUBLIC_MAPS_PROVIDER=google only after Maps JavaScript API and
 * billing are enabled for the key's project. The components still fall back
 * to OpenStreetMap if Google rejects the key at runtime.
 */
export function googleMapsProviderEnabled(): boolean {
  const provider = (process.env.NEXT_PUBLIC_MAPS_PROVIDER ?? "")
    .trim()
    .toLowerCase();
  return provider === "google" && googleMapsApiKey().length > 0;
}
