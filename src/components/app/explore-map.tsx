"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
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
}: {
  tractors: TractorWithOwner[];
  center: { lat: number; lng: number };
}) {
  const { t } = useI18n();
  const [googleFailed, setGoogleFailed] = useState(false);
  const useGoogle = googleMapsProviderEnabled() && !googleFailed;

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
      <div className="pointer-events-none absolute left-3 top-3 z-[500] flex items-center gap-1.5 rounded-full border border-forest/10 bg-paper/95 px-3 py-1.5 text-[0.65rem] font-semibold text-forest shadow-sm backdrop-blur">
        <span className="size-1.5 rounded-full bg-forest pulse-ring" />
        {tractors.length} {tractors.length === 1 ? t("app.tractorSingular") : t("app.tractorPlural")}{" "}
        {t("app.onTheMap")}
      </div>
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
            center,
            zoom: 11,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
            gestureHandling: "cooperative",
          });
          mapRef.current = map;
          infoRef.current = new google.maps.InfoWindow();
          setReady(true);
          // Backup for a key that is rejected without Google's error overlay.
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
      infoRef.current?.close();
      infoRef.current = null;
      mapRef.current = null;
      setReady(false);
    };
    // The map shell is created once; later effects keep markers and centre fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      map.setCenter(center);
      map.setZoom(11);
    }
  }, [center, ready, tractors, t]);

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

      L.control.zoom({ position: "bottomright" }).addTo(map);

      const youIcon = L.divIcon({
        className: "",
        html: `<span style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;background:#163b2a;border:3px solid #f7f2e6;box-shadow:0 6px 18px -6px rgba(22,59,42,.7);color:#e2c88c;font-size:15px;">⌂</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      L.marker([center.lat, center.lng], { icon: youIcon, zIndexOffset: 500 })
        .addTo(map)
        .bindTooltip(t("common.currentLocation"), { direction: "top", offset: [0, -14] });

      markersRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      markersRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
