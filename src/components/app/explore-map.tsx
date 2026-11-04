"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { Loader2 } from "lucide-react";
import {
  googleMapsProviderEnabled,
  loadGoogleMaps,
  onGoogleMapsAuthFailure,
  watchGoogleMapsError,
  type GoogleInfoWindow,
  type GoogleMap,
  type GoogleMarker,
} from "@/lib/google-maps";
import { useI18n } from "@/lib/i18n";
import { formatRupees } from "@/lib/pricing";
import type { TractorWithOwner } from "@/lib/types";
import { cn } from "@/lib/utils";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function rateLabel(tractor: TractorWithOwner) {
  if (tractor.pricing.hourlyEnabled) {
    return `${formatRupees(tractor.pricing.hourlyRate)}/hr`;
  }
  if (tractor.pricing.acreEnabled) {
    return `${formatRupees(tractor.pricing.acreRate)}/acre`;
  }
  return `${formatRupees(tractor.pricing.tripRate)}/trip`;
}

export default function ExploreMap({
  tractors,
  center,
  onLocate,
  locating = false,
}: {
  tractors: TractorWithOwner[];
  center: { lat: number; lng: number };
  onLocate?: () => void;
  locating?: boolean;
}) {
  const { t } = useI18n();
  const [googleFailed, setGoogleFailed] = useState(false);
  const [internalLocating, setInternalLocating] = useState(false);
  const useGoogle = googleMapsProviderEnabled() && !googleFailed;
  const isLocating = locating || internalLocating;

  function handleLocate() {
    if (onLocate) {
      onLocate();
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      alert("Location requires HTTPS or localhost.");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setInternalLocating(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setInternalLocating(false);
      },
      (error) => {
        setInternalLocating(false);
        console.warn("[ExploreMap] Geolocation failed:", error);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-line bg-sand shadow-[var(--shadow-card)]">
      {useGoogle ? (
        <GoogleExploreMap
          tractors={tractors}
          center={center}
          onError={() => setGoogleFailed(true)}
        />
      ) : (
        <LeafletExploreMap tractors={tractors} center={center} />
      )}

      {/* Tractors count badge */}
      <div className="pointer-events-none absolute left-3 top-3 z-[500] flex items-center gap-1.5 rounded-full border border-forest/10 bg-paper/95 px-3 py-1.5 text-[0.65rem] font-semibold text-forest shadow-sm backdrop-blur">
        <span className="size-1.5 rounded-full bg-forest pulse-ring" />
        {tractors.length} {tractors.length === 1 ? t("app.tractorSingular") : t("app.tractorPlural")}{" "}
        {t("app.onTheMap")}
      </div>

      {/* Floating Auto-Detect Location Button (Image 2) */}
      <button
        type="button"
        onClick={handleLocate}
        disabled={isLocating}
        aria-label={t("common.useMyLocation") || "Auto-detect current location"}
        title={t("common.useMyLocation") || "Auto-detect current location"}
        className={cn(
          "absolute bottom-5 right-4 z-[500] flex size-11 items-center justify-center rounded-full bg-paper border border-black/15 shadow-[0_4px_16px_rgba(0,0,0,0.18)] text-forest transition-all hover:bg-white hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-forest/40 disabled:opacity-70 disabled:cursor-wait",
          isLocating && "animate-pulse cursor-wait",
        )}
      >
        {isLocating ? (
          <Loader2 className="size-5 animate-spin text-forest" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5 text-forest"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="7" />
            <line x1="12" y1="2" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="2" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="22" y2="12" />
          </svg>
        )}
      </button>
    </div>
  );
}

function GoogleExploreMap({
  tractors,
  center,
  onError,
}: {
  tractors: TractorWithOwner[];
  center: { lat: number; lng: number };
  onError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const userMarkerRef = useRef<GoogleMarker | null>(null);
  const markersRef = useRef<GoogleMarker[]>([]);
  const infoRef = useRef<GoogleInfoWindow | null>(null);
  const [ready, setReady] = useState(false);
  const { t } = useI18n();

  useEffect(() => onGoogleMapsAuthFailure(onError), [onError]);

  useEffect(() => {
    let cancelled = false;
    const stopWatching = containerRef.current
      ? watchGoogleMapsError(containerRef.current, onError)
      : () => {};
    const stopWatchingTimer = window.setTimeout(stopWatching, 10000);
    let healthTimer: number | undefined;
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        try {
          const map = new google.maps.Map(containerRef.current, {
            center: { lat: center.lat, lng: center.lng },
            zoom: 11,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
            gestureHandling: "cooperative",
          });
          mapRef.current = map;
          infoRef.current = new google.maps.InfoWindow();

          // User location marker
          userMarkerRef.current = new google.maps.Marker({
            position: { lat: center.lat, lng: center.lng },
            map,
            title: t("common.currentLocation"),
            zIndex: 999,
          });

          setReady(true);
          healthTimer = window.setTimeout(() => {
            if (
              !cancelled &&
              !containerRef.current?.querySelector(".gm-style")
            ) {
              onError();
            }
          }, 12000);
        } catch {
          if (!cancelled) onError();
        }
      })
      .catch(() => {
        if (!cancelled) onError();
      });

    return () => {
      cancelled = true;
      window.clearTimeout(stopWatchingTimer);
      if (healthTimer) window.clearTimeout(healthTimer);
      stopWatching();
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      userMarkerRef.current?.setMap(null);
      userMarkerRef.current = null;
      infoRef.current?.close();
      infoRef.current = null;
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update center when user's location changes
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.panTo({ lat: center.lat, lng: center.lng });
    map.setZoom(13);
    userMarkerRef.current?.setPosition({ lat: center.lat, lng: center.lng });
  }, [center.lat, center.lng, ready]);

  useEffect(() => {
    const google = typeof window !== "undefined" ? window.google : undefined;
    const map = mapRef.current;
    const info = infoRef.current;
    if (!ready || !google || !map) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    const bounds = new google.maps.LatLngBounds();

    for (const tractor of tractors) {
      const marker = new google.maps.Marker({
        position: { lat: tractor.lat, lng: tractor.lng },
        map,
        title: `${tractor.brand} ${tractor.model}`,
      });
      marker.addListener("click", () => {
        info?.setContent(
          `<div style="font-family:Manrope,sans-serif;min-width:190px;padding:2px 0;">
            <div style="font-family:Fraunces,Georgia,serif;font-size:17px;color:#163b2a;line-height:1.15;">${escapeHtml(
              `${tractor.brand} ${tractor.model}`,
            )}</div>
            <div style="margin-top:3px;font-size:11px;color:#667066;">${escapeHtml(
              tractor.owner.name,
            )} · ${escapeHtml(tractor.village)}</div>
            <div style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <span style="font-size:11px;font-weight:700;color:#163b2a;">${escapeHtml(
                rateLabel(tractor),
              )}</span>
              <span style="font-size:10px;color:#667066;">${tractor.distanceKm} km</span>
            </div>
            <a href="/tractors/${encodeURIComponent(
              tractor.id,
            )}" style="margin-top:9px;display:block;border-radius:999px;background:#163b2a;color:#f7f2e6;text-align:center;padding:7px 10px;font-size:11px;font-weight:700;text-decoration:none;">${escapeHtml(
              t("app.viewTractor"),
            )}</a>
          </div>`,
        );
        info?.open({ map, anchor: marker });
      });
      markersRef.current.push(marker);
      bounds.extend({ lat: tractor.lat, lng: tractor.lng });
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 46);
    } else {
      map.setCenter({ lat: center.lat, lng: center.lng });
      map.setZoom(11);
    }
  }, [center.lat, center.lng, ready, tractors, t]);

  return <div ref={containerRef} className="h-[430px] w-full lg:h-[590px]" />;
}

function LeafletExploreMap({
  tractors,
  center,
}: {
  tractors: TractorWithOwner[];
  center: { lat: number; lng: number };
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const userMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const markersRef = useRef<import("leaflet").LayerGroup | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        scrollWheelZoom: false,
        attributionControl: true,
      }).setView([center.lat, center.lng], 11);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // Position zoom controls in top-right so bottom-right is dedicated to locate button
      L.control.zoom({ position: "topright" }).addTo(map);

      // User current location pulsing pin
      const youIcon = L.divIcon({
        className: "",
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:40px;height:40px;">
          <span style="position:absolute;width:100%;height:100%;border-radius:999px;background:rgba(22,59,42,0.25);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></span>
          <span style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;background:#163b2a;border:3px solid #f7f2e6;box-shadow:0 6px 18px -6px rgba(22,59,42,.7);color:#e2c88c;font-size:15px;position:relative;">⌂</span>
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      const marker = L.marker([center.lat, center.lng], { icon: youIcon, zIndexOffset: 500 })
        .addTo(map)
        .bindTooltip(t("common.currentLocation"), { direction: "top", offset: [0, -14] });
      userMarkerRef.current = marker;

      markersRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      userMarkerRef.current = null;
      markersRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update center when farmer's GPS location is detected
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([center.lat, center.lng], 13, { duration: 1.2 });
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([center.lat, center.lng]);
    }
  }, [center.lat, center.lng]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current || !markersRef.current) return;
      const map = mapRef.current;
      const layer = markersRef.current;
      layer.clearLayers();

      const bounds: [number, number][] = [];
      for (const tractor of tractors) {
        const pin = L.divIcon({
          className: "",
          html: `<span style="display:inline-flex;align-items:center;gap:4px;padding:5px 9px;border-radius:999px;background:#fffdf7;border:1px solid rgba(22,59,42,.22);box-shadow:0 8px 20px -10px rgba(23,35,27,.6);color:#163b2a;font-family:Manrope,sans-serif;font-size:11px;font-weight:800;white-space:nowrap;">▰ ${escapeHtml(rateLabel(tractor))}</span>`,
          iconSize: [74, 28],
          iconAnchor: [37, 28],
        });
        const marker = L.marker([tractor.lat, tractor.lng], { icon: pin });
        marker.bindPopup(
          `<div style="font-family:Manrope,sans-serif;min-width:190px;padding:2px 0;">
            <div style="font-family:Fraunces,Georgia,serif;font-size:17px;color:#163b2a;line-height:1.15;">${escapeHtml(
              `${tractor.brand} ${tractor.model}`,
            )}</div>
            <div style="margin-top:3px;font-size:11px;color:#667066;">${escapeHtml(
              tractor.owner.name,
            )} · ${escapeHtml(tractor.village)}</div>
            <div style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <span style="font-size:11px;font-weight:700;color:#163b2a;">${escapeHtml(
                rateLabel(tractor),
              )}</span>
              <span style="font-size:10px;color:#667066;">${tractor.distanceKm} km</span>
            </div>
            <a href="/tractors/${encodeURIComponent(
              tractor.id,
            )}" style="margin-top:9px;display:block;border-radius:999px;background:#163b2a;color:#f7f2e6;text-align:center;padding:7px 10px;font-size:11px;font-weight:700;text-decoration:none;">${escapeHtml(
              t("app.viewTractor"),
            )}</a>
          </div>`,
          { closeButton: true, offset: [0, -22] },
        );
        marker.addTo(layer);
        bounds.push([tractor.lat, tractor.lng]);
      }

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [46, 46], maxZoom: 13 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tractors, t]);

  return <div ref={containerRef} className="h-[430px] w-full lg:h-[590px]" />;
}
