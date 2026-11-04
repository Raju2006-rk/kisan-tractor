"use client";

import { useDeferredValue, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowRight,
  Compass,
  List,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Search,
  SlidersHorizontal,
  Tractor,
  X,
} from "lucide-react";
import { TractorCard } from "@/components/app/tractor-card";
import {
  Badge,
  Button,
  buttonStyles,
  EmptyState,
  Select,
  Skeleton,
} from "@/components/ui/primitives";
import { useToast } from "@/components/providers/app-providers";
import { SERVICES, VILLAGES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import type { PricingType, ServiceType, SessionUser, TractorWithOwner } from "@/lib/types";
import { cn, reverseGeocode } from "@/lib/utils";

const ExploreMap = dynamic(() => import("@/components/app/explore-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-[430px] w-full lg:h-[590px]" />,
});

type Sort = "nearest" | "price";

export function ExploreScreen({ user }: { user: SessionUser }) {
  const { t, serviceLabel } = useI18n();
  const { push } = useToast();
  const [query, setQuery] = useState("");
  const [service, setService] = useState<ServiceType | "all">("all");
  const [pricing, setPricing] = useState<PricingType | "all">("all");
  const [distance, setDistance] = useState("all");
  const [sort, setSort] = useState<Sort>("nearest");
  const [view, setView] = useState<"list" | "map">("list");
  const [locating, setLocating] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const profile = user.farmerProfile ?? user.ownerProfile;
  const center = profile
    ? { lat: profile.lat, lng: profile.lng }
    : { lat: VILLAGES[0].lat, lng: VILLAGES[0].lng };
  const [coords, setCoords] = useState(center);
  const [locationLabel, setLocationLabel] = useState(profile?.village ?? "");
  const areaLabel =
    [profile?.village, profile?.district, profile?.state]
      .filter(Boolean)
      .join(" · ");
  const pricingLabel = (item: PricingType) =>
    item === "hourly"
      ? t("app.hourly")
      : item === "acre"
        ? t("app.perAcre")
        : t("app.perTrip");

  const key = useMemo(() => {
    const params = new URLSearchParams();
    if (deferredQuery.trim()) params.set("q", deferredQuery.trim());
    if (service !== "all") params.set("service", service);
    if (pricing !== "all") params.set("pricing", pricing);
    if (distance !== "all") params.set("distance", distance);
    params.set("lat", String(coords.lat));
    params.set("lng", String(coords.lng));
    const queryString = params.toString();
    return `/api/tractors${queryString ? `?${queryString}` : ""}`;
  }, [deferredQuery, service, pricing, distance, coords.lat, coords.lng]);

  const { data, isLoading, error } = useSWR<{ tractors: TractorWithOwner[] }>(key);
  const tractors = useMemo(() => {
    const rows = [...(data?.tractors ?? [])];
    if (sort === "price") {
      rows.sort((a, b) => {
        const priceOf = (tractor: TractorWithOwner) =>
          Math.min(
            tractor.pricing.hourlyEnabled ? tractor.pricing.hourlyRate : Infinity,
            tractor.pricing.acreEnabled ? tractor.pricing.acreRate : Infinity,
            tractor.pricing.tripEnabled ? tractor.pricing.tripRate : Infinity,
          );
        return priceOf(a) - priceOf(b);
      });
    } else {
      rows.sort((a, b) => a.distanceKm - b.distanceKm);
    }
    return rows;
  }, [data?.tractors, sort]);

  const hasFilters =
    query.trim().length > 0 ||
    service !== "all" ||
    pricing !== "all" ||
    distance !== "all" ||
    sort !== "nearest";

  function resetFilters() {
    setQuery("");
    setService("all");
    setPricing("all");
    setDistance("all");
    setSort("nearest");
  }

  function useMyLocation() {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      push(t("app.locationNeedsHttps"), "error");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      push(t("app.browserNoLocation"), "error");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Math.round(position.coords.latitude * 10000) / 10000;
        const lng = Math.round(position.coords.longitude * 10000) / 10000;
        setCoords({ lat, lng });

        try {
          const geo = await reverseGeocode(lat, lng);
          setLocationLabel(geo.village || t("app.yourLocation"));
        } catch {
          setLocationLabel(t("app.yourLocation"));
        } finally {
          setLocating(false);
        }

        push(t("app.showingNearLocation"), "success");
      },
      (positionError) => {
        setLocating(false);
        push(
          positionError.code === positionError.PERMISSION_DENIED
            ? t("app.locationBlocked")
            : positionError.code === positionError.TIMEOUT
              ? t("app.locationTimeout")
              : t("app.locationFailed"),
          "error",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="green" dot>
              {t("app.farmerTag")}
            </Badge>
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-stone/70">
              {areaLabel}
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl text-forest sm:text-[2.4rem]">
            {t("app.exploreTitle")}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-stone">{t("app.exploreSub")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={useMyLocation}
            loading={locating}
            className="inline-flex"
          >
            <LocateFixed className="size-3.5" />
            {locating ? t("common.locating") : t("common.useMyLocation")}
          </Button>
          <div className="flex rounded-full border border-line bg-paper p-1">
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                view === "list" ? "bg-forest text-cream" : "text-stone hover:text-forest",
              )}
            >
              <List className="size-3.5" /> {t("app.listView")}
            </button>
            <button
              type="button"
              onClick={() => setView("map")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                view === "map" ? "bg-forest text-cream" : "text-stone hover:text-forest",
              )}
            >
              <MapIcon className="size-3.5" /> {t("app.mapView")}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-line/80 bg-paper p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-line bg-cream/50 px-3.5 focus-within:border-forest/40 focus-within:ring-4 focus-within:ring-forest/8">
            <Search className="size-4 shrink-0 text-stone/60" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("common.searchTractors")}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-stone/55 focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                aria-label={t("common.search")}
                onClick={() => setQuery("")}
                className="text-stone/60 hover:text-forest"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-auto">
            <Select
              aria-label={t("app.distance")}
              value={distance}
              onChange={(event) => setDistance(event.target.value)}
              className="h-11 bg-cream/50 text-xs"
            >
              <option value="all">{t("app.anyDistance")}</option>
              <option value="5">{t("app.within5")}</option>
              <option value="10">{t("app.within10")}</option>
              <option value="25">{t("app.within25")}</option>
            </Select>
            <Select
              aria-label={t("app.sortNearest")}
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              className="h-11 bg-cream/50 text-xs"
            >
              <option value="nearest">{t("app.sortNearest")}</option>
              <option value="price">{t("app.sortPrice")}</option>
            </Select>
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasFilters}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-line bg-paper px-3 text-xs font-semibold text-stone transition hover:border-forest/25 hover:text-forest disabled:opacity-40"
            >
              <SlidersHorizontal className="size-3.5" /> {t("common.reset")}
            </button>
          </div>
        </div>

        <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setService("all")}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[0.7rem] font-semibold transition",
              service === "all"
                ? "border-forest bg-forest text-cream"
                : "border-line bg-cream/40 text-stone hover:border-forest/25 hover:text-forest",
            )}
          >
            {t("app.allWork")}
          </button>
          {SERVICES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setService(item.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[0.7rem] font-semibold transition",
                service === item.id
                  ? "border-forest bg-forest text-cream"
                  : "border-line bg-cream/40 text-stone hover:border-forest/25 hover:text-forest",
              )}
            >
              {serviceLabel(item.id)}
            </button>
          ))}
          <span className="mx-1 w-px shrink-0 bg-line" />
          <button
            type="button"
            onClick={() => setPricing("all")}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[0.7rem] font-semibold transition",
              pricing === "all"
                ? "border-clay/30 bg-clay/10 text-clay-dark"
                : "border-line bg-cream/40 text-stone hover:border-clay/25 hover:text-clay-dark",
            )}
          >
            {t("app.anyRate")}
          </button>
          {(["hourly", "acre", "trip"] as PricingType[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPricing(item)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[0.7rem] font-semibold transition",
                pricing === item
                  ? "border-clay/30 bg-clay/10 text-clay-dark"
                  : "border-line bg-cream/40 text-stone hover:border-clay/25 hover:text-clay-dark",
              )}
            >
              {pricingLabel(item)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-stone">
          {isLoading ? (
            t("app.findingTractors")
          ) : (
            <>{t("app.tractorsAvailableNear", {
              count: tractors.length,
              tractorWord:
                tractors.length === 1
                  ? t("app.tractorSingular")
                  : t("app.tractorPlural"),
              location: locationLabel || t("app.yourArea"),
            })}</>
          )}
        </p>
        <p className="inline-flex items-center gap-1.5 text-[0.65rem] text-stone/70">
          <span className="size-1.5 rounded-full bg-forest pulse-ring" />
          {t("app.showingOnline")}
        </p>
      </div>

      {error ? (
        <EmptyState
          icon={<Compass className="size-5" />}
          title={t("common.somethingWentWrong")}
          body={error instanceof Error ? error.message : t("common.tryAgain")}
          action={
            <button type="button" onClick={resetFilters} className={buttonStyles("outline", "sm")}>
              {t("common.tryAgain")}
            </button>
          }
        />
      ) : view === "map" ? (
        <ExploreMap tractors={tractors} center={coords} onLocate={useMyLocation} locating={locating} />
      ) : isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-48 w-full" />
          ))}
        </div>
      ) : tractors.length === 0 ? (
        <EmptyState
          icon={<Tractor className="size-5" />}
          title={t("common.noResults")}
          body={t("app.noResultsBody")}
          action={
            <button type="button" onClick={resetFilters} className={buttonStyles("primary", "sm")}>
              {t("app.clearFilters")} <X className="size-3.5" />
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {tractors.map((tractor) => (
            <TractorCard key={tractor.id} tractor={tractor} layout="row" />
          ))}
          <div className="flex flex-col items-start justify-between gap-3 rounded-[1.4rem] border border-forest/10 bg-[linear-gradient(120deg,#eaf0e4,#f3ecd9)] p-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-forest text-wheat">
                <MapPin className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-forest">{t("app.cantFindTractor")}</p>
                <p className="mt-0.5 text-[0.7rem] leading-relaxed text-stone">
                  {t("app.cantFindTractorBody")}
                </p>
              </div>
            </div>
            <Link href="/help" className={buttonStyles("outline", "sm", "shrink-0")}>
              {t("common.help")} <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
