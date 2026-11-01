export type GoogleLatLng = { lat: number; lng: number };

export type GoogleMap = {
  setCenter(position: GoogleLatLng): void;
  setZoom(zoom: number): void;
  panTo(position: GoogleLatLng): void;
  fitBounds(
    bounds: GoogleBounds,
    padding?: number | { top: number; right: number; bottom: number; left: number },
  ): void;
};

export type GoogleBounds = {
  extend(position: GoogleLatLng): void;
  isEmpty(): boolean;
};

export type GoogleMarker = {
  setPosition(position: GoogleLatLng): void;
  setMap(map: GoogleMap | null): void;
  addListener(event: string, handler: () => void): void;
};

export type GoogleInfoWindow = {
  setContent(content: string): void;
  open(options: { map: GoogleMap; anchor?: GoogleMarker }): void;
  close(): void;
};

export type GoogleMapsApi = {
  maps: {
    Map: new (
      element: HTMLElement,
      options: Record<string, unknown>,
    ) => GoogleMap;
    Marker: new (options: Record<string, unknown>) => GoogleMarker;
    InfoWindow: new (options?: Record<string, unknown>) => GoogleInfoWindow;
    LatLngBounds: new () => GoogleBounds;
  };
};

declare global {
  interface Window {
    google?: GoogleMapsApi;
  }
}

const SCRIPT_ATTR = "data-kisantractor-google-maps";

let loaderPromise: Promise<GoogleMapsApi> | null = null;

/** Browser key. The same key can be restricted by HTTP referrer in Google Cloud. */
export function googleMapsApiKey(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim();
}

export function hasGoogleMapsKey(): boolean {
  return googleMapsApiKey().length > 0;
}

/**
 * Load the Google Maps JavaScript API once per page. Components fall back to
 * the OpenStreetMap/Leaflet renderer when no key is configured or the script
 * cannot load (offline, blocked network, invalid key).
 */
export function loadGoogleMaps(): Promise<GoogleMapsApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser."));
  }
  if (window.google?.maps) return Promise.resolve(window.google);

  const key = googleMapsApiKey();
  if (!key) {
    return Promise.reject(new Error("Google Maps API key is not configured."));
  }

  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[${SCRIPT_ATTR}="true"]`,
    );
    const script = existing ?? document.createElement("script");

    const handleLoad = () => {
      if (window.google?.maps) resolve(window.google);
      else {
        loaderPromise = null;
        reject(new Error("Google Maps loaded without the maps library."));
      }
    };
    const handleError = () => {
      loaderPromise = null;
      reject(new Error("Could not load Google Maps."));
    };

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existing) {
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        key,
      )}&v=weekly&region=IN&language=en`;
      script.async = true;
      script.defer = true;
      script.setAttribute(SCRIPT_ATTR, "true");
      document.head.appendChild(script);
    }
  });

  return loaderPromise;
}
