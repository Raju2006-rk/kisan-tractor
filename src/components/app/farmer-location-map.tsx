"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import type { LiveLocation } from "@/lib/types";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const farmMarkerRef = useRef<Marker | null>(null);
  const farmerMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);

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
            <div style="font-size:12px;font-weight:800;color:#163b2a;">Farmer live location</div>
            <div style="margin-top:2px;font-size:11px;color:#667066;">Shared for this booking</div>
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

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-sand">
      <div ref={containerRef} className="h-56 w-full" />
      <div className="pointer-events-none absolute left-2.5 top-2.5 z-[500] flex flex-wrap items-center gap-2 rounded-full border border-forest/10 bg-paper/95 px-2.5 py-1 text-[0.6rem] font-semibold text-forest shadow-sm backdrop-blur">
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-forest" /> Farm land
        </span>
        {farmer ? (
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-clay" /> Farmer GPS
          </span>
        ) : null}
      </div>
    </div>
  );
}
