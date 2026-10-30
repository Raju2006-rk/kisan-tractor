"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Crosshair,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  Radio,
  ShieldCheck,
  Square,
} from "lucide-react";
import { Alert, Button, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/providers/app-providers";
import type { BookingDetail, Role } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const FarmerLocationMap = dynamic(
  () => import("@/components/app/farmer-location-map"),
  { ssr: false, loading: () => <Skeleton className="h-56 w-full rounded-2xl" /> },
);

const SHARING_STATUSES = [
  "ACCEPTED",
  "SCHEDULED",
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETION_PENDING",
];

export function LiveLocationCard({
  booking,
  role,
  onUpdated,
}: {
  booking: BookingDetail;
  role: Role;
  onUpdated?: (booking: BookingDetail) => void;
}) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  const canShare = role === "farmer" && SHARING_STATUSES.includes(booking.status);
  const shared = Boolean(booking.farmerLocation?.sharing);
  const farm = booking.serviceLocation;
  const live = shared ? booking.farmerLocation : null;

  const stopWatch = useCallback(() => {
    if (watchRef.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  const send = useCallback(
    async (payload: Record<string, unknown>) => {
      const response = await fetch(`/api/bookings/${booking.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "share_location", payload }),
      });
      const data = (await response.json()) as {
        error?: string;
        booking?: BookingDetail;
      };
      if (!response.ok) throw new Error(data.error ?? "Could not update your location.");
      if (data.booking) onUpdated?.(data.booking);
      return data.booking;
    },
    [booking.id, onUpdated],
  );

  const publish = useCallback(
    async (position: GeolocationPosition, announce: boolean) => {
      const now = Date.now();
      if (!announce && now - lastSentRef.current < 15000) return;
      lastSentRef.current = now;
      await send({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        sharing: true,
      });
    },
    [send],
  );

  const startWatch = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    stopWatch();
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        void publish(position, false).catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
  }, [publish, stopWatch]);

  useEffect(() => {
    if (role === "farmer" && shared) startWatch();
    return () => stopWatch();
    // Restart only when sharing toggles; the watcher keeps the same booking id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, shared]);

  async function startSharing() {
    setBusy(true);
    setError(null);
    try {
      if (!navigator.geolocation) {
        throw new Error("Your browser cannot share GPS location.");
      }
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        });
      });
      await publish(position, true);
      startWatch();
      push("Live location shared with the tractor owner.", "success");
    } catch (shareError) {
      const isGeoError =
        typeof shareError === "object" &&
        shareError !== null &&
        "code" in shareError &&
        "message" in shareError;
      const message = isGeoError
        ? "Location permission was not given. Allow location access and try again."
        : shareError instanceof Error
          ? shareError.message
          : "Could not share your location.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function stopSharing() {
    setBusy(true);
    setError(null);
    try {
      stopWatch();
      await send({ sharing: false });
      push("Live location sharing stopped.", "success");
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : "Could not stop sharing.");
    } finally {
      setBusy(false);
    }
  }

  if (role === "farmer") {
    if (!canShare) return null;
    return (
      <div className="rounded-2xl border border-line/80 bg-cream/30 p-4">
        <div className="flex items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-clay/10 text-clay-dark">
            <Crosshair className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-forest">Share live farm location</p>
            <p className="mt-0.5 text-[0.68rem] leading-relaxed text-stone">
              The tractor owner can see your GPS position on a map only while you are sharing.
              Stop at any time.
            </p>
            {error ? (
              <Alert tone="danger" className="mt-2">
                {error}
              </Alert>
            ) : null}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {shared ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-forest/10 px-2.5 py-1 text-[0.62rem] font-semibold text-forest">
                    <Radio className="size-3 animate-pulse" /> Sharing live
                  </span>
                  <Button variant="ghost" size="sm" onClick={stopSharing} loading={busy}>
                    <Square className="size-3" /> Stop sharing
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={startSharing} loading={busy}>
                  <LocateFixed className="size-3.5" /> Share my current location
                </Button>
              )}
            </div>
            {shared && booking.farmerLocation ? (
              <p className="mt-1.5 text-[0.6rem] text-stone">
                Updated {formatDateTime(booking.farmerLocation.updatedAt)}
                {booking.farmerLocation.accuracy
                  ? ` · ±${Math.round(booking.farmerLocation.accuracy)} m`
                  : ""}
              </p>
            ) : null}
            <p className="mt-2 flex items-start gap-1.5 text-[0.6rem] leading-relaxed text-stone">
              <ShieldCheck className="mt-0.5 size-3 shrink-0 text-forest" />
              Your location is shared only with this booking’s tractor owner and is removed when
              you stop sharing.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const destination = live ?? farm;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`;

  return (
    <div className="rounded-2xl border border-line/80 bg-cream/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-forest/8 text-forest">
            <Navigation className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-forest">Track farmer & farm land</p>
            <p className="mt-0.5 text-[0.68rem] leading-relaxed text-stone">
              {live
                ? "The farmer is sharing live GPS for this booking."
                : "Live GPS is not shared yet. The farm address is still shown on the map."}
            </p>
          </div>
        </div>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-forest/20 bg-paper px-2.5 py-1.5 text-[0.62rem] font-semibold text-forest transition hover:border-forest/40"
        >
          <ExternalLink className="size-3" /> Go to farm land
        </a>
      </div>

      <div className="mt-3">
        <FarmerLocationMap
          farm={{
            lat: farm.lat,
            lng: farm.lng,
            label: farm.label,
            village: farm.village,
          }}
          farmer={live}
        />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.62rem] text-stone">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3" /> {farm.village} · {farm.label}
        </span>
        {live ? (
          <span className="inline-flex items-center gap-1 font-semibold text-clay-dark">
            <Radio className="size-3 animate-pulse" /> Live · {formatDateTime(live.updatedAt)}
            {live.accuracy ? ` · ±${Math.round(live.accuracy)} m` : ""}
          </span>
        ) : (
          <span>Ask the farmer to share live location from their booking screen.</span>
        )}
      </div>
    </div>
  );
}
