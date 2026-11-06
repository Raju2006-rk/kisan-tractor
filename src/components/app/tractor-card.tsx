"use client";

import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { Photo } from "@/components/ui/photo";
import { Badge } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import { formatRupees } from "@/lib/pricing";
import type { TractorWithOwner } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TractorCard({
  tractor,
  layout = "row",
  className,
}: {
  tractor: TractorWithOwner;
  layout?: "row" | "grid";
  className?: string;
}) {
  const { t } = useI18n();
  const rates = [
    tractor.pricing.hourlyEnabled && {
      label: t("app.hourly"),
      value: tractor.pricing.hourlyRate,
      unit: t("common.perHour"),
    },
    tractor.pricing.acreEnabled && {
      label: t("app.perAcre"),
      value: tractor.pricing.acreRate,
      unit: t("common.perAcre"),
    },
    tractor.pricing.tripEnabled && {
      label: t("app.perTrip"),
      value: tractor.pricing.tripRate,
      unit: t("common.perTrip"),
    },
  ].filter(Boolean) as { label: string; value: number; unit: string }[];

  return (
    <Link
      href={`/tractors/${tractor.id}`}
      className={cn(
        "group block overflow-hidden rounded-[1.4rem] border border-line/80 bg-paper shadow-(--shadow-card) transition hover:-translate-y-0.5 hover:border-forest/25 hover:shadow-soft",
        layout === "row" && "flex flex-col sm:flex-row",
        className,
      )}
    >
      <div
        className={cn(
          "relative shrink-0",
          layout === "row" ? "h-40 w-full sm:h-auto sm:w-48" : "h-44 w-full",
        )}
      >
        <Photo
          src={tractor.image}
          alt={`${tractor.brand} ${tractor.model}`}
          className="h-full w-full"
          imageClassName="transition duration-700 group-hover:scale-105"
          sizes={layout === "row" ? "(max-width: 640px) 100vw, 200px" : "(max-width: 768px) 100vw, 33vw"}
        />
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1">
          <Badge tone={tractor.isAvailable ? "green" : "stone"} dot>
            {tractor.isAvailable ? t("common.available") : t("common.offline")}
          </Badge>
        </div>
        <span className="absolute bottom-2.5 right-2.5 rounded-full bg-ink/65 px-2 py-0.5 text-[0.6rem] font-semibold text-cream backdrop-blur">
          {tractor.distanceKm} km
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-xl text-forest">
              {tractor.brand} {tractor.model}
            </h3>
            <p className="mt-0.5 truncate text-xs text-stone">
              {tractor.owner.name} · {tractor.horsepower} HP
            </p>
          </div>
        </div>
        <p className="mt-1.5 inline-flex items-center gap-1 text-[0.68rem] text-stone">
          <MapPin className="size-3" /> {tractor.village}, {tractor.district}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {rates.map((rate) => (
            <span
              key={rate.label}
              className="rounded-lg border border-line/80 bg-cream/60 px-2 py-0.5 text-[0.62rem] font-semibold text-forest"
            >
              {formatRupees(rate.value)}
              <span className="font-normal text-stone">{rate.unit}</span>
            </span>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="flex flex-wrap gap-1">
            {tractor.equipment.slice(0, 3).map((item) => (
              <span key={item.id} className="text-[0.6rem] text-stone">
                {item.name}
                {tractor.equipment.indexOf(item) < Math.min(2, tractor.equipment.length - 1) ? " ·" : ""}
              </span>
            ))}
          </div>
          <span className="inline-flex items-center gap-1 text-[0.68rem] font-semibold text-forest transition group-hover:text-clay">
            {t("app.viewTractor")} <ArrowRight className="size-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}
