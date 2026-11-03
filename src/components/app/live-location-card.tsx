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
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
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
      if (!response.ok) throw new Error(data.error ?? t("app.couldNotUpdateLocation"));
      if (data.booking) onUpdated?.(data.booking);
      return data.booking;
    },
    [booking.id, onUpdated, t],
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
        throw new Error(t("app.browserCannotShareGps"));
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
      push(t("app.liveLocationShared"), "success");
    } catch (shareError) {
      const isGeoError =
        typeof shareError === "object" &&
        shareError !== null &&
        "code" in shareError &&
        "message" in shareError;
      const message = isGeoError
        ? t("app.locationPermissionNotGiven")
        : shareError instanceof Error
          ? shareError.message
          : t("app.couldNotShareLocation");
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
      push(t("app.locationSharingStopped"), "success");
    } catch (stopError) {
      setError(
        stopError instanceof Error
          ? stopError.message
          : t("app.couldNotStopSharing"),
      );
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
            <p className="text-sm font-semibold text-forest">{t("app.shareLiveFarmLocation")}</p>
            <p className="mt-0.5 text-[0.68rem] leading-relaxed text-stone">
              {t("app.shareLiveFarmLocationBody")}
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
                    <Radio className="size-3 animate-pulse" /> {t("app.sharingLive")}
                  </span>
                  <Button variant="ghost" size="sm" onClick={stopSharing} loading={busy}>
                    <Square className="size-3" /> {t("app.stopSharing")}
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={startSharing} loading={busy}>
                  <LocateFixed className="size-3.5" /> {t("app.shareMyCurrentLocation")}
                </Button>
              )}
            </div>
            {shared && booking.farmerLocation ? (
              <p className="mt-1.5 text-[0.6rem] text-stone">
                {t("app.updatedAt", {
                  date: formatDateTime(booking.farmerLocation.updatedAt),
                })}
                {booking.farmerLocation.accuracy
                  ? ` · ±${Math.round(booking.farmerLocation.accuracy)} m`
                  : ""}
              </p>
            ) : null}
            <p className="mt-2 flex items-start gap-1.5 text-[0.6rem] leading-relaxed text-stone">
              <ShieldCheck className="mt-0.5 size-3 shrink-0 text-forest" />
              {t("app.locationSharedOnlyWithOwner")}
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
            <p className="text-sm font-semibold text-forest">{t("app.trackFarmerFarm")}</p>
            <p className="mt-0.5 text-[0.68rem] leading-relaxed text-stone">
              {live
                ? t("app.farmerSharingLive")
                : t("app.liveGpsNotShared")}
            </p>
          </div>
        </div>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-forest/20 bg-paper px-2.5 py-1.5 text-[0.62rem] font-semibold text-forest transition hover:border-forest/40"
        >
          <ExternalLink className="size-3" /> {t("app.goToFarmLand")}
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
            <Radio className="size-3 animate-pulse" /> {t("app.liveLabel")} · {formatDateTime(live.updatedAt)}
            {live.accuracy ? ` · ±${Math.round(live.accuracy)} m` : ""}
          </span>
        ) : (
          <span>{t("app.askFarmerShareLocation")}</span>
        )}
      </div>
    </div>
  );
}
