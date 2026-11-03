import {
  googleMapsApiKey,
  googleMapsProviderEnabled,
} from "@/lib/google-maps-key";

export { googleMapsApiKey, googleMapsProviderEnabled };

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
    gm_authFailure?: () => void;
  }
}

const SCRIPT_ATTR = "data-kisantractor-google-maps";

let loaderPromise: Promise<GoogleMapsApi> | null = null;
let authFailed = false;
const authFailureListeners = new Set<() => void>();

function handleAuthFailure() {
  authFailed = true;
  loaderPromise = null;
  for (const listener of authFailureListeners) listener();
}

/**
 * Google calls window.gm_authFailure when the browser key is rejected (for
 * example an API restriction or a missing Maps JavaScript API enablement).
 * Components subscribe so they can switch to the OpenStreetMap renderer.
 */
export function onGoogleMapsAuthFailure(listener: () => void): () => void {
  authFailureListeners.add(listener);
  if (authFailed) listener();
  return () => {
    authFailureListeners.delete(listener);
  };
}

const BLOCKED_MAP_PATTERN =
  /can't load Google Maps correctly|didn't load Google Maps correctly/i;

/**
 * Google draws its "This page can't load Google Maps correctly" overlay for
 * rejected keys instead of rejecting the loader. Watch the map container
 * briefly so the caller can switch to the OpenStreetMap renderer.
 */
export function watchGoogleMapsError(
  element: HTMLElement,
  listener: () => void,
): () => void {
  if (typeof document === "undefined") return () => {};
  let scheduled = false;
  let stopped = false;

  const stop = () => {
    stopped = true;
    observer.disconnect();
  };
  const check = () => {
    if (stopped) return;
    if (BLOCKED_MAP_PATTERN.test(element.textContent ?? "")) {
      stop();
      listener();
    }
  };
  const observer = new MutationObserver(() => {
    if (scheduled || stopped) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      check();
    });
  });
  observer.observe(element, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  check();
  return stop;
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
  if (authFailed) {
    return Promise.reject(new Error("Google Maps authentication failed."));
  }
  if (!googleMapsProviderEnabled()) {
    return Promise.reject(new Error("Google Maps is not enabled."));
  }
  if (window.google?.maps) return Promise.resolve(window.google);

  const key = googleMapsApiKey();
  if (!key) {
    return Promise.reject(new Error("Google Maps API key is not configured."));
  }

  if (loaderPromise) return loaderPromise;

  window.gm_authFailure = handleAuthFailure;

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
