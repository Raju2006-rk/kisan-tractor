"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import {
  googleMapsProviderEnabled,
  loadGoogleMaps,
  onGoogleMapsAuthFailure,
  watchGoogleMapsError,
  type GoogleInfoWindow,
  type GoogleMap,
  type GoogleMarker,
} from "@/lib/google-maps";
import type { LiveLocation } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const farmIconHtml = `<span style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:999px;background:#163b2a;border:3px solid #f7f2e6;box-shadow:0 6px 18px -6px rgba(22,59,42,.7);color:#e2c88c;font-size:16px;">⌂</span>`;
const farmerIconHtml = `<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:999px;background:#c06a3e;border:3px solid #f7f2e6;box-shadow:0 6px 18px -6px rgba(192,106,62,.8);color:#fff;font-size:13px;">●</span>`;

export default function FarmerLocationMap({
  farm,
  farmer,
}: {
  farm: { lat: number; lng: number; label: string; village: string };
  farmer?: LiveLocation | null;
}) {
  const [googleFailed, setGoogleFailed] = useState(false);
  const { t } = useI18n();
  const useGoogle = googleMapsProviderEnabled() && !googleFailed;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-sand">
      {useGoogle ? (
        <GoogleFarmerLocationMap
          farm={farm}
          farmer={farmer}
          onError={() => setGoogleFailed(true)}
        />
      ) : (
        <LeafletFarmerLocationMap farm={farm} farmer={farmer} />
      )}
      <div className="pointer-events-none absolute left-2.5 top-2.5 z-[500] flex flex-wrap items-center gap-2 rounded-full border border-forest/10 bg-paper/95 px-2.5 py-1 text-[0.6rem] font-semibold text-forest shadow-sm backdrop-blur">
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-forest" /> {t("app.farmLand")}
        </span>
        {farmer ? (
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-clay" /> {t("app.farmerGps")}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function GoogleFarmerLocationMap({
  farm,
  farmer,
  onError,
}: {
  farm: { lat: number; lng: number; label: string; village: string };
  farmer?: LiveLocation | null;
  onError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const farmMarkerRef = useRef<GoogleMarker | null>(null);
  const farmerMarkerRef = useRef<GoogleMarker | null>(null);
  const infoRef = useRef<GoogleInfoWindow | null>(null);
  const { t } = useI18n();
  const labelsRef = useRef({ title: "", shared: "" });
  useEffect(() => {
    labelsRef.current = {
      title: t("app.farmerLiveLocation"),
      shared: t("app.sharedForBooking"),
    };
  }, [t]);
  const [ready, setReady] = useState(false);

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
            center: { lat: farm.lat, lng: farm.lng },
            zoom: 14,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
            gestureHandling: "cooperative",
          });
          mapRef.current = map;
          infoRef.current = new google.maps.InfoWindow();

          const farmMarker = new google.maps.Marker({
            position: { lat: farm.lat, lng: farm.lng },
            map,
            title: farm.label,
            label: "F",
          });
          farmMarker.addListener("click", () => {
            infoRef.current?.setContent(
              `<div style="font-family:Manrope,sans-serif;min-width:170px;padding:2px 0;">
                <div style="font-family:Fraunces,Georgia,serif;font-size:15px;color:#163b2a;">${escapeHtml(
                  farm.label,
                )}</div>
                <div style="margin-top:2px;font-size:11px;color:#667066;">${escapeHtml(
                  farm.village,
                )} · Farm land</div>
              </div>`,
            );
            infoRef.current?.open({ map, anchor: farmMarker });
          });
          farmMarkerRef.current = farmMarker;
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
      farmMarkerRef.current?.setMap(null);
      farmerMarkerRef.current?.setMap(null);
      farmMarkerRef.current = null;
      farmerMarkerRef.current = null;
      infoRef.current?.close();
      infoRef.current = null;
      mapRef.current = null;
      setReady(false);
    };
    // The map shell is created once; the marker effect below keeps positions fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const google = typeof window !== "undefined" ? window.google : undefined;
    const map = mapRef.current;
    if (!ready || !google || !map) return;

    if (!farmer) {
      farmerMarkerRef.current?.setMap(null);
      farmerMarkerRef.current = null;
      map.setCenter({ lat: farm.lat, lng: farm.lng });
      return;
    }

    if (!farmerMarkerRef.current) {
      const marker = new google.maps.Marker({
        position: { lat: farmer.lat, lng: farmer.lng },
        map,
        title: labelsRef.current.title,
        label: "L",
      });
      marker.addListener("click", () => {
        infoRef.current?.setContent(
          `<div style="font-family:Manrope,sans-serif;min-width:150px;padding:2px 0;">
            <div style="font-size:12px;font-weight:800;color:#163b2a;">${escapeHtml(labelsRef.current.title)}</div>
            <div style="margin-top:2px;font-size:11px;color:#667066;">${escapeHtml(labelsRef.current.shared)}</div>
          </div>`,
        );
        infoRef.current?.open({ map, anchor: marker });
      });
      farmerMarkerRef.current = marker;

      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: farm.lat, lng: farm.lng });
      bounds.extend({ lat: farmer.lat, lng: farmer.lng });
      if (!bounds.isEmpty()) map.fitBounds(bounds, 50);
    } else {
      farmerMarkerRef.current.setPosition({
        lat: farmer.lat,
        lng: farmer.lng,
      });
    }
  }, [farm.lat, farm.lng, farmer, ready]);

  return <div ref={containerRef} className="h-56 w-full" />;
}

function LeafletFarmerLocationMap({
  farm,
  farmer,
}: {
  farm: { lat: number; lng: number; label: string; village: string };
  farmer?: LiveLocation | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const farmMarkerRef = useRef<Marker | null>(null);
  const farmerMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const { t } = useI18n();
  const labelsRef = useRef({ title: "", shared: "" });
  useEffect(() => {
    labelsRef.current = {
      title: t("app.farmerLiveLocation"),
      shared: t("app.sharedForBooking"),
    };
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        scrollWheelZoom: false,
      }).setView([farm.lat, farm.lng], 14);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);

      const farmIcon = L.divIcon({
        className: "",
        html: farmIconHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      farmMarkerRef.current = L.marker([farm.lat, farm.lng], {
        icon: farmIcon,
        zIndexOffset: 300,
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:Manrope,sans-serif;min-width:170px;padding:2px 0;">
            <div style="font-family:Fraunces,Georgia,serif;font-size:15px;color:#163b2a;">${escapeHtml(
              farm.label,
            )}</div>
            <div style="margin-top:2px;font-size:11px;color:#667066;">${escapeHtml(
              farm.village,
            )} · Farm land</div>
          </div>`,
        );

      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      farmMarkerRef.current = null;
      farmerMarkerRef.current = null;
      leafletRef.current = null;
      setReady(false);
    };
    // The map shell is created once; the marker effect below keeps positions fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (!farmer) {
      farmerMarkerRef.current?.remove();
      farmerMarkerRef.current = null;
      map.setView([farm.lat, farm.lng], map.getZoom(), { animate: true });
      return;
    }

    if (!farmerMarkerRef.current) {
      const farmerIcon = L.divIcon({
        className: "",
        html: farmerIconHtml,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      farmerMarkerRef.current = L.marker([farmer.lat, farmer.lng], {
        icon: farmerIcon,
        zIndexOffset: 600,
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:Manrope,sans-serif;min-width:150px;padding:2px 0;">
            <div style="font-size:12px;font-weight:800;color:#163b2a;">${escapeHtml(labelsRef.current.title)}</div>
            <div style="margin-top:2px;font-size:11px;color:#667066;">${escapeHtml(labelsRef.current.shared)}</div>
          </div>`,
        );
      map.fitBounds(
        [
          [farm.lat, farm.lng],
          [farmer.lat, farmer.lng],
        ],
        { padding: [50, 50], maxZoom: 15 },
      );
    } else {
      farmerMarkerRef.current.setLatLng([farmer.lat, farmer.lng]);
    }
  }, [farm.lat, farm.lng, farmer, ready]);

  return <div ref={containerRef} className="h-56 w-full" />;
}
