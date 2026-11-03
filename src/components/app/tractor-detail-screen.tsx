"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  Clock3,
  Gauge,
  HandCoins,
  Info,
  MapPin,
  Phone,
  Ruler,
  ShieldCheck,
  Sprout,
  Tractor as TractorIcon,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";
import { Photo } from "@/components/ui/photo";
import { Avatar, Badge, Card, LinkButton } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import { formatRupees } from "@/lib/pricing";
import type { Equipment, SessionUser, TractorWithOwner } from "@/lib/types";

const equipmentIcons: Record<string, typeof Wrench> = {
  eq_plough: Wrench,
  eq_rotavator: Sprout,
  eq_trolley: Truck,
  eq_seed_drill: Sprout,
  eq_sprayer: Sprout,
};

function EquipmentRow({ equipment }: { equipment: Equipment }) {
  const { equipmentLabel, equipmentDescription } = useI18n();
  const Icon = equipmentIcons[equipment.id] ?? Wrench;
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line/70 bg-cream/40 px-3.5 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-forest/8 text-forest">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-sm font-semibold text-forest">
          {equipmentLabel(equipment.id, equipment.name)}
        </p>
        <p className="mt-0.5 text-[0.68rem] leading-relaxed text-stone">
          {equipmentDescription(equipment.id, equipment.description)}
        </p>
      </div>
      <Check className="ml-auto mt-1 size-3.5 shrink-0 text-forest/60" />
    </div>
  );
}

export function TractorDetailScreen({
  tractor,
  user,
}: {
  tractor: TractorWithOwner;
  user: SessionUser;
}) {
  const { t } = useI18n();

  const rates = [
    tractor.pricing.hourlyEnabled && {
      type: "hourly" as const,
      label: t("app.hourly"),
      rate: tractor.pricing.hourlyRate,
      note: t("tractor.rateHourlyNote"),
      unit: t("common.perHour"),
      icon: Clock3,
    },
    tractor.pricing.acreEnabled && {
      type: "acre" as const,
      label: t("app.perAcre"),
      rate: tractor.pricing.acreRate,
      note: t("tractor.rateAcreNote"),
      unit: t("common.perAcre"),
      icon: Ruler,
    },
    tractor.pricing.tripEnabled && {
      type: "trip" as const,
      label: t("app.perTrip"),
      rate: tractor.pricing.tripRate,
      note: t("tractor.rateTripNote"),
      unit: t("common.perTrip"),
      icon: Truck,
    },
  ].filter(Boolean) as {
    type: "hourly" | "acre" | "trip";
    label: string;
    rate: number;
    note: string;
    unit: string;
    icon: typeof Clock3;
  }[];

  const lowestRate = Math.min(...rates.map((rate) => rate.rate));
  const lowest = rates.find((rate) => rate.rate === lowestRate);
  const isOwnerViewing = user.role === "owner";
  const isOwnTractor = tractor.ownerId === user.id;
  const canBook = user.role === "farmer" && tractor.isAvailable;
  const bookHref = `/book?tractor=${encodeURIComponent(tractor.id)}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/explore"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone transition hover:text-forest"
        >
          <ArrowLeft className="size-3.5" /> {t("app.backToExplore")}
        </Link>
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-stone/60">
          {t("tractor.idLabel", { id: tractor.id })}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.55fr_0.85fr] lg:items-start">
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-line bg-sand shadow-[var(--shadow-card)]">
            <Photo
              src={tractor.image}
              alt={`${tractor.brand} ${tractor.model}`}
              className="aspect-[16/10] w-full"
              sizes="(max-width: 1024px) 100vw, 62vw"
              priority
            />
            <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
              <Badge tone={tractor.isAvailable ? "green" : "stone"} dot>
                {tractor.isAvailable
                  ? t("app.availableForBookings")
                  : t("app.ownerOfflineLabel")}
              </Badge>
              <Badge tone="stone">{tractor.horsepower} HP</Badge>
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-2">
              <span className="rounded-full bg-ink/70 px-3 py-1.5 text-[0.68rem] font-semibold text-cream backdrop-blur">
                <MapPin className="mr-1 inline size-3" />
                {tractor.village}, {tractor.district} ·{" "}
                {t("common.kmAway", { distance: tractor.distanceKm })}
              </span>
            </div>
          </div>

          {tractor.images.length > 1 ? (
            <div className="grid grid-cols-3 gap-2">
              {tractor.images.slice(0, 3).map((image, index) => (
                <Photo
                  key={`${image}-${index}`}
                  src={image}
                  alt={`${tractor.brand} ${tractor.model} photo ${index + 1}`}
                  className="aspect-[4/3] w-full rounded-2xl border border-line"
                  sizes="(max-width: 1024px) 33vw, 20vw"
                />
              ))}
            </div>
          ) : null}

          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">{t("tractor.eyebrow")}</p>
                <h1 className="mt-2 font-display text-3xl text-forest sm:text-[2.5rem]">
                  {tractor.brand} {tractor.model}
                </h1>
                <p className="mt-1 text-sm text-stone">
                  {t("tractor.ownedBy", {
                    name: tractor.owner.name,
                    village: tractor.village,
                    district: tractor.district,
                  })}
                </p>
              </div>
              <Badge tone="green">
                <BadgeCheck className="size-3" /> {t("tractor.localOwner")}
              </Badge>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-cream/60 px-3 py-2.5">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-stone">
                  {t("app.horsepower")}
                </p>
                <p className="mt-0.5 font-display text-lg text-forest">{tractor.horsepower} HP</p>
              </div>
              <div className="rounded-xl bg-cream/60 px-3 py-2.5">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-stone">
                  {t("app.manufacturingYear")}
                </p>
                <p className="mt-0.5 font-display text-lg text-forest">
                  {tractor.manufacturingYear}
                </p>
              </div>
              <div className="rounded-xl bg-cream/60 px-3 py-2.5">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-stone">
                  {t("app.serviceRadius")}
                </p>
                <p className="mt-0.5 font-display text-lg text-forest">
                  {tractor.serviceRadiusKm} km
                </p>
              </div>
            </div>

            <div className="mt-5">
              <h2 className="font-display text-xl text-forest">{t("tractor.workTitle")}</h2>
              <p className="mt-1 text-xs leading-relaxed text-stone">{t("tractor.workBody")}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {tractor.equipment.map((equipment) => (
                  <EquipmentRow key={equipment.id} equipment={equipment} />
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="font-display text-xl text-forest">{t("tractor.ratesTitle")}</h2>
            <p className="mt-1 text-xs leading-relaxed text-stone">{t("tractor.ratesBody")}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {rates.map((rate) => (
                <div
                  key={rate.type}
                  className="rounded-2xl border border-line/80 bg-cream/40 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-forest/8 text-forest">
                      <rate.icon className="size-3.5" />
                    </span>
                    <Badge tone="outline">{rate.label}</Badge>
                  </div>
                  <p className="mt-3 font-display text-2xl text-forest">
                    {formatRupees(rate.rate)}
                    <span className="text-xs font-normal text-stone">{rate.unit}</span>
                  </p>
                  <p className="mt-1 text-[0.65rem] leading-relaxed text-stone">{rate.note}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={tractor.owner.name} size="lg" />
                <div>
                  <p className="font-display text-xl text-forest">{tractor.owner.name}</p>
                  <p className="mt-0.5 text-xs text-stone">
                    {t("tractor.ownerRole", {
                      village: tractor.village,
                      district: tractor.district,
                    })}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.62rem] text-stone">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" />
                      {t("tractor.serviceArea", { km: tractor.serviceRadiusKm })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={tractor.ownerProfile.online ? "green" : "stone"} dot>
                  {tractor.ownerProfile.online ? t("common.online") : t("common.offline")}
                </Badge>
                <Badge tone="stone">{t("app.verifiedMobile")}</Badge>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-forest/5 px-3.5 py-3 text-[0.7rem] leading-relaxed text-forest/80">
              <Phone className="mt-0.5 size-3.5 shrink-0" />
              {t("tractor.contactNote")}
            </div>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-24">
          <Card className="overflow-hidden">
            <div className="bg-forest px-5 py-4 text-cream">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-wheat/80">
                {t("tractor.ratesFrom")}
              </p>
              <p className="mt-1 font-display text-3xl text-cream">
                {formatRupees(lowestRate)}
                <span className="ml-1 text-xs font-normal text-cream/55">{lowest?.unit}</span>
              </p>
              <p className="mt-1 text-[0.68rem] text-cream/55">{t("tractor.chooseNext")}</p>
            </div>
            <div className="space-y-3 p-5">
              <div className="space-y-2 text-[0.72rem]">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-stone">
                    <CalendarDays className="size-3.5" /> {t("tractor.booking")}
                  </span>
                  <span className="font-semibold text-forest">
                    {t("tractor.ownerConfirmsFirst")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-stone">
                    <HandCoins className="size-3.5" /> {t("tractor.payment")}
                  </span>
                  <span className="font-semibold text-forest">{t("app.directToOwner")}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-stone">
                    <ShieldCheck className="size-3.5" /> {t("tractor.commission")}
                  </span>
                  <span className="font-semibold text-forest">₹0</span>
                </div>
              </div>

              {isOwnerViewing ? (
                <div className="rounded-xl border border-line bg-cream/60 px-3.5 py-3 text-[0.7rem] leading-relaxed text-stone">
                  {isOwnTractor ? (
                    <>
                      {t("tractor.ownListing")}{" "}
                      <Link href="/owner/tractor" className="font-semibold text-forest underline">
                        {t("tractor.manageListing")}
                      </Link>
                      .
                    </>
                  ) : (
                    t("tractor.ownerSignedIn")
                  )}
                </div>
              ) : null}

              {canBook ? (
                <>
                  <LinkButton href={bookHref} size="lg" className="w-full">
                    {t("tractor.bookThis")} <ArrowRight className="size-4" />
                  </LinkButton>
                  <LinkButton
                    href={`${bookHref}&for=other`}
                    variant="outline"
                    className="w-full"
                  >
                    <UserRound className="size-3.5" /> {t("app.bookForSomeone")}
                  </LinkButton>
                </>
              ) : !isOwnerViewing ? (
                <div className="rounded-xl border border-wheat/70 bg-wheat/20 px-3.5 py-3 text-[0.7rem] leading-relaxed text-[#6d5118]">
                  {t("tractor.offlineNote")}
                </div>
              ) : null}

              <p className="flex items-start gap-2 text-[0.65rem] leading-relaxed text-stone">
                <Info className="mt-0.5 size-3 shrink-0" />
                {t("app.noPaymentNow")}
              </p>
              <div className="rounded-xl border border-dashed border-line px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-stone">
                  <TractorIcon className="size-3" /> {t("app.registration")}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-forest">
                  {tractor.registrationNumber}
                </p>
              </div>
            </div>
          </Card>

          <div className="mt-3 rounded-2xl border border-line/70 bg-paper/60 p-4">
            <p className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-stone">
              <Gauge className="size-3.5" /> {t("tractor.goodToKnow")}
            </p>
            <p className="mt-2 text-[0.68rem] leading-relaxed text-stone">
              {t("tractor.goodToKnowBody")}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
