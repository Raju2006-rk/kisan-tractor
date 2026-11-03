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
