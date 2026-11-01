"use client";

import Link from "next/link";
import useSWR from "swr";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Compass,
  HandCoins,
  IndianRupee,
  MapPin,
  Plus,
  ReceiptText,
  Tractor,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";
import { BookingActions, useWorkMinutes } from "@/components/app/booking-actions";
import { BookingCard } from "@/components/app/booking-card";
import { OwnerEarningsCard } from "@/components/app/owner-earnings";
import { TractorCard } from "@/components/app/tractor-card";
import { Badge, buttonStyles, Card, EmptyState, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { Photo } from "@/components/ui/photo";
import { PRICING_UNITS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { formatRupees, minutesToHoursLabel } from "@/lib/pricing";
import type {
  BookingDetail,
  OwnerEarningsSummary,
  SessionUser,
  TractorWithOwner,
} from "@/lib/types";
import { cn, formatDateTime, relativeDay } from "@/lib/utils";

type BookingsResponse = { bookings: BookingDetail[] };

const activePriority = [
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETION_PENDING",
  "BILL_GENERATED",
  "PAYMENT_PENDING",
  "PENDING",
  "SCHEDULED",
  "ACCEPTED",
  "PAID",
];

function pickActive(bookings: BookingDetail[]) {
  return [...bookings]
    .filter((booking) => activePriority.includes(booking.status))
    .sort((a, b) => {
      const priority =
        activePriority.indexOf(a.status) - activePriority.indexOf(b.status);
      if (priority !== 0) return priority;
      return b.updatedAt.localeCompare(a.updatedAt);
    })[0];
}

export function FarmerDashboard({ user }: { user: SessionUser }) {
  const { t } = useI18n();
  const { data, isLoading, mutate } = useSWR<BookingsResponse>("/api/bookings", {
    refreshInterval: 25000,
  });
  const { data: tractorData, isLoading: tractorsLoading } = useSWR<{
    tractors: TractorWithOwner[];
  }>("/api/tractors");

  const bookings = data?.bookings ?? [];
  const active = pickActive(bookings);
  const tractors = tractorData?.tractors?.slice(0, 3) ?? [];
  const upcoming = bookings
    .filter((booking) => ["ACCEPTED", "SCHEDULED", "PENDING"].includes(booking.status))
    .slice(0, 2);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="green" dot>{t("app.farmerTag")}</Badge>
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-stone/70">
              {user.farmerProfile?.village
                ? `${user.farmerProfile.village}${user.farmerProfile.district ? `, ${user.farmerProfile.district}` : ""}`
                : t("common.locationNotSet")}
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl text-forest sm:text-[2.4rem]">
            {t("app.namaste", { name: user.name.split(" ")[0] })}
          </h1>
          <p className="mt-1 text-sm text-stone">{t("app.farmerHomeSub")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/explore" className={buttonStyles("primary", "md")}>
            <Compass className="size-4" /> {t("app.findTractorTitle")}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="relative overflow-hidden rounded-[1.6rem] bg-forest p-5 text-cream shadow-soft sm:p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full border border-cream/10" />
          <div className="pointer-events-none absolute -bottom-20 right-10 size-64 rounded-full border border-cream/10" />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-wheat/80">
                {active ? t("app.activeBooking") : t("app.farmWork")}
              </span>
              {active ? <StatusBadge status={active.status} role="farmer" className="!border-cream/15 !bg-cream/10 !text-cream" /> : null}
            </div>

            {isLoading ? (
              <div className="mt-5 space-y-3">
                <Skeleton className="h-8 w-2/3 !bg-cream/10" />
                <Skeleton className="h-4 w-1/2 !bg-cream/10" />
                <Skeleton className="h-16 w-full !bg-cream/10" />
              </div>
            ) : active ? (
              <ActiveFarmerJob booking={active} onUpdated={() => mutate()} />
            ) : (
              <div className="mt-4">
                <h2 className="font-display text-2xl text-cream sm:text-3xl">
                  {t("app.noActiveWork")}
                </h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-cream/65">
                  {t("app.noActiveWorkBody")}
                </p>
                <Link href="/explore" className={buttonStyles("secondary", "md", "mt-5")}>
                  {t("app.findTractorTitle")} <ArrowRight className="size-4" />
                </Link>
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Link
            href="/explore"
            className="group flex items-center justify-between gap-3 rounded-2xl border border-line/80 bg-paper p-4 shadow-[var(--shadow-card)] transition hover:border-forest/25"
          >
            <div>
              <span className="flex size-9 items-center justify-center rounded-xl bg-forest/8 text-forest">
                <Compass className="size-4" />
              </span>
              <p className="mt-2 text-sm font-semibold text-forest">{t("nav.explore")}</p>
              <p className="mt-0.5 text-[0.68rem] text-stone">{t("app.findNearbyTractors")}</p>
            </div>
            <ArrowUpRight className="size-4 text-stone transition group-hover:text-clay" />
          </Link>
          <Link
            href="/explore?for=other"
            className="group flex items-center justify-between gap-3 rounded-2xl border border-line/80 bg-paper p-4 shadow-[var(--shadow-card)] transition hover:border-forest/25"
          >
            <div>
              <span className="flex size-9 items-center justify-center rounded-xl bg-clay/10 text-clay-dark">
                <UserRound className="size-4" />
              </span>
              <p className="mt-2 text-sm font-semibold text-forest">{t("app.bookForSomeone")}</p>
              <p className="mt-0.5 text-[0.68rem] text-stone">{t("app.forFamilyNoAccount")}</p>
            </div>
            <ArrowUpRight className="size-4 text-stone transition group-hover:text-clay" />
          </Link>
          <Link
            href="/bookings"
            className="group flex items-center justify-between gap-3 rounded-2xl border border-line/80 bg-paper p-4 shadow-[var(--shadow-card)] transition hover:border-forest/25 sm:col-span-2 lg:col-span-1"
          >
            <div>
              <span className="flex size-9 items-center justify-center rounded-xl bg-wheat/40 text-[#7a5a1d]">
                <CalendarDays className="size-4" />
              </span>
              <p className="mt-2 text-sm font-semibold text-forest">{t("app.bookingsTitle")}</p>
              <p className="mt-0.5 text-[0.68rem] text-stone">
                {isLoading
                  ? t("common.loading")
                  : bookings.length === 1
                    ? t("app.bookingOnRecordOne")
                    : t("app.bookingsOnRecord", { count: bookings.length })}
              </p>
            </div>
            <ArrowUpRight className="size-4 text-stone transition group-hover:text-clay" />
          </Link>
        </div>
      </div>

      {upcoming.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl text-forest">{t("app.upcomingWork")}</h2>
            <Link href="/bookings" className="text-xs font-semibold text-forest hover:text-clay">
              {t("common.viewAll")} →
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {upcoming.map((booking) => (
              <BookingCard key={booking.id} booking={booking} role="farmer" compact />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-forest">{t("app.tractorNearby")}</h2>
            <p className="text-xs text-stone">{t("app.tractorNearbySub")}</p>
          </div>
          <Link href="/explore" className={buttonStyles("outline", "sm")}>
            {t("common.viewAll")} <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {tractorsLoading
            ? [0, 1, 2].map((item) => <Skeleton key={item} className="h-44" />)
            : tractors.map((tractor) => (
                <TractorCard key={tractor.id} tractor={tractor} layout="grid" />
              ))}
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          {
            title: t("app.hourly"),
            body: t("app.hourlyBody"),
            example: "₹800 / hour",
            icon: Clock3,
          },
          {
            title: t("app.perAcre"),
            body: t("app.perAcreBody"),
            example: "₹1,200 / acre",
            icon: Tractor,
          },
          {
            title: t("app.perTrip"),
            body: t("app.perTripBody"),
            example: "₹1,500 / trip",
            icon: ReceiptText,
          },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-line/70 bg-paper/70 p-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-forest/8 text-forest">
              <item.icon className="size-3.5" />
            </span>
            <p className="mt-2 text-sm font-semibold text-forest">{item.title}</p>
            <p className="mt-1 text-[0.68rem] leading-relaxed text-stone">{item.body}</p>
            <p className="mt-2 text-[0.65rem] font-semibold text-moss">{item.example}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-start justify-between gap-4 rounded-[1.4rem] border border-forest/10 bg-[linear-gradient(120deg,#eaf0e4,#f3ecd9)] p-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-forest text-wheat">
            <HandCoins className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-forest">{t("app.paymentTitle")}</p>
            <p className="mt-1 max-w-xl text-[0.7rem] leading-relaxed text-stone">
              {t("common.directPayment")} {t("common.noCommission")}
            </p>
          </div>
        </div>
        <Link href="/help#billing" className={buttonStyles("outline", "sm", "shrink-0")}>
          {t("app.howPaymentWorks")} <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

function ActiveFarmerJob({
  booking,
  onUpdated,
}: {
  booking: BookingDetail;
  onUpdated: () => void;
}) {
  const { t, serviceLabel } = useI18n();
  const { minutes, breakMinutes } = useWorkMinutes(booking);
  const isPaused = booking.status === "PAUSED";
  const amount = booking.finalAmount ?? booking.estimatedAmount;

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl leading-tight text-cream sm:text-[1.75rem]">
            {serviceLabel(booking.serviceType)} · {booking.tractor.brand} {booking.tractor.model}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-cream/55">
            <span>{booking.owner.name}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" /> {booking.serviceLocation.village}
            </span>
            <span>{booking.id}</span>
          </p>
        </div>
        <div className="rounded-xl border border-cream/12 bg-cream/8 px-3 py-2 text-right">
          <p className="text-[0.55rem] font-bold uppercase tracking-[0.14em] text-cream/50">
            {booking.finalAmount !== null ? t("app.finalBill") : t("app.estimateLabel")}
          </p>
          <p className="font-display text-xl text-cream">{formatRupees(amount)}</p>
        </div>
      </div>

      {isPaused ? (
        <div className="mt-4 rounded-2xl border border-wheat/30 bg-wheat/10 px-3.5 py-3 text-[0.7rem] leading-relaxed text-cream/80">
          {t("app.workPausedBody")}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-cream/8 px-3 py-2.5">
          <p className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-cream/45">
            {t("app.activeLabel")}
          </p>
          <p className="mt-0.5 font-display text-lg text-cream">{minutesToHoursLabel(minutes)}</p>
        </div>
        <div className="rounded-xl bg-cream/8 px-3 py-2.5">
          <p className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-cream/45">
            {t("app.breakLabel")}
          </p>
          <p className="mt-0.5 font-display text-lg text-cream">{minutesToHoursLabel(breakMinutes)}</p>
        </div>
        <div className="rounded-xl bg-cream/8 px-3 py-2.5">
          <p className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-cream/45">
            {t("app.rateLabel")}
          </p>
          <p className="mt-0.5 font-display text-lg text-cream">
            {formatRupees(booking.agreedRate)}
            <span className="text-[0.6rem] font-normal text-cream/50">
              {PRICING_UNITS[booking.pricingType]}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={`/bookings/${booking.id}`} className={buttonStyles("secondary", "sm")}>
          {t("app.openActiveJob")} <ArrowRight className="size-3.5" />
        </Link>
        <BookingActions booking={booking} role="farmer" onUpdated={onUpdated} />
      </div>
      <p className="mt-3 text-[0.62rem] text-cream/40">
        {t("app.onlyOwnerAccept")} {t("app.onlyOwnerConfirm")}
      </p>
    </div>
  );
}

type OwnerDashboardResponse = {
  dashboard: {
    tractorCount: number;
    newRequests: number;
    upcoming: number;
    completed: number;
    recordedEarnings: number;
    earnings: OwnerEarningsSummary;
    bookings: BookingDetail[];
  };
};

export function OwnerDashboard({ user }: { user: SessionUser }) {
  const { t } = useI18n();
  const { data, isLoading, mutate } = useSWR<OwnerDashboardResponse>(
    "/api/owner/dashboard",
    { refreshInterval: 25000 },
  );
  const { data: tractorData } = useSWR<{ tractors: TractorWithOwner[] }>(
    "/api/tractors?owner=me",
  );

  const dashboard = data?.dashboard;
  const bookings = dashboard?.bookings ?? [];
  const requests = bookings.filter((booking) => booking.status === "PENDING");
  const active = bookings.find((booking) =>
    ["IN_PROGRESS", "PAUSED", "COMPLETION_PENDING"].includes(booking.status),
  );
  const upcoming = bookings.filter((booking) =>
    ["ACCEPTED", "SCHEDULED"].includes(booking.status),
  );
  const paymentPending = bookings.filter(
    (booking) => booking.status === "PAYMENT_PENDING",
  );
  const payments = bookings
    .flatMap((booking) =>
      booking.payments.map((payment) => ({ booking, payment })),
    )
    .sort((a, b) => b.payment.paidAt.localeCompare(a.payment.paidAt))
    .slice(0, 4);
  const tractor = tractorData?.tractors?.[0];

  const stats = [
    {
      label: t("app.ownerRequests"),
      value: isLoading && !dashboard ? "—" : (dashboard?.newRequests ?? 0),
      icon: CalendarDays,
      tone: "bg-clay/10 text-clay-dark",
    },
    {
      label: t("app.ownerUpcoming"),
      value: isLoading && !dashboard ? "—" : (dashboard?.upcoming ?? 0),
      icon: Clock3,
      tone: "bg-wheat/40 text-[#7a5a1d]",
    },
    {
      label: t("app.ownerCompleted"),
      value: isLoading && !dashboard ? "—" : (dashboard?.completed ?? 0),
      icon: CheckCircle2,
      tone: "bg-forest/8 text-forest",
    },
    {
      label: t("app.ownerEarnings"),
      value: isLoading && !dashboard ? "—" : formatRupees(dashboard?.recordedEarnings ?? 0),
      icon: IndianRupee,
      tone: "bg-forest/8 text-forest",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="green" dot>{t("app.ownerTag")}</Badge>
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-stone/70">
              {user.ownerProfile?.village
                ? `${user.ownerProfile.village}${user.ownerProfile.district ? `, ${user.ownerProfile.district}` : ""}`
                : t("common.locationNotSet")}
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl text-forest sm:text-[2.4rem]">
            {t("app.namaste", { name: user.name.split(" ")[0] })}
          </h1>
          <p className="mt-1 text-sm text-stone">{t("app.ownerHomeSub")}</p>
        </div>
        <Link href="/owner/tractor" className={buttonStyles("primary", "md")}>
          <Tractor className="size-4" /> {t("app.manageTractor")}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className={cn("flex size-8 items-center justify-center rounded-lg", stat.tone)}>
                <stat.icon className="size-3.5" />
              </span>
              <TrendingUp className="size-3 text-stone/40" />
            </div>
            <p className="mt-2.5 font-display text-2xl text-forest">{stat.value}</p>
            <p className="mt-0.5 text-[0.65rem] font-medium text-stone">{stat.label}</p>
          </Card>
        ))}
      </div>

      {dashboard?.earnings ? (
        <OwnerEarningsCard earnings={dashboard.earnings} />
      ) : isLoading ? (
        <Skeleton className="h-72" />
      ) : null}

      {isLoading ? (
        <Skeleton className="h-56" />
      ) : active ? (
        <OwnerActiveJob booking={active} onUpdated={() => mutate()} />
      ) : (
        <Card className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-forest/8 text-forest">
              <Tractor className="size-4" />
            </span>
            <div>
              <p className="font-display text-xl text-forest">{t("app.noActiveJob")}</p>
              <p className="mt-1 max-w-lg text-xs leading-relaxed text-stone">
                {t("app.noActiveJobBody")}
              </p>
            </div>
          </div>
          <Link href="/bookings" className={buttonStyles("outline", "sm")}>
            {t("app.viewSchedule")} <ArrowRight className="size-3.5" />
          </Link>
        </Card>
      )}

      {paymentPending.length > 0 ? (
        <Card className="overflow-hidden border-wheat/60">
          <div className="flex items-center justify-between gap-2 border-b border-wheat/40 bg-wheat/15 px-4 py-3">
            <div>
              <h2 className="font-display text-lg text-forest">{t("app.paymentsToConfirm")}</h2>
              <p className="text-[0.65rem] text-stone">
                {t("app.paymentsToConfirmBody")}
              </p>
            </div>
            <Badge tone="clay">{paymentPending.length}</Badge>
          </div>
          <div className="divide-y divide-line/70">
            {paymentPending.map((booking) => (
              <Link
                key={booking.id}
                href={`/bookings/${booking.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-cream/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-forest">
                    {booking.farmer.name} · {booking.serviceLocation.village}
                  </p>
                  <p className="text-[0.62rem] text-stone">
                    {booking.id} ·{" "}
                    {t("app.due", {
                      amount: formatRupees(
                        booking.finalAmount ?? booking.estimatedAmount,
                      ),
                    })}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-forest px-2.5 py-1 text-[0.62rem] font-semibold text-cream">
                  {t("app.markPaymentDone")} <ArrowRight className="size-3" />
                </span>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="font-display text-xl text-forest">{t("app.ownerRequests")}</h2>
              <p className="text-xs text-stone">{t("app.ownerRequestsSub")}</p>
            </div>
            <Link href="/bookings" className="text-xs font-semibold text-forest hover:text-clay">
              {t("common.viewAll")} →
            </Link>
          </div>
          <div className="space-y-3">
            {requests.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="size-5" />}
                title={t("app.noNewRequests")}
                body={t("app.noNewRequestsBody")}
              />
            ) : (
              requests.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  role="owner"
                  showActions
                  onUpdated={() => mutate()}
                />
              ))
            )}
          </div>
        </section>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4">
              <h2 className="font-display text-lg text-forest">{t("app.yourTractor")}</h2>
              <Link href="/owner/tractor" className="text-[0.65rem] font-semibold text-forest hover:text-clay">
                {t("common.edit")} →
              </Link>
            </div>
            {tractor ? (
              <div className="p-4">
                <Photo
                  src={tractor.image}
                  alt={`${tractor.brand} ${tractor.model}`}
                  className="h-32 w-full rounded-xl"
                  sizes="300px"
                />
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-lg text-forest">
                      {tractor.brand} {tractor.model}
                    </p>
                    <p className="text-[0.68rem] text-stone">
                      {tractor.registrationNumber} · {tractor.horsepower} HP
                    </p>
                  </div>
                  <Badge tone={tractor.isAvailable ? "green" : "stone"} dot>
                    {tractor.isAvailable ? t("common.available") : t("common.offline")}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {tractor.pricing.hourlyEnabled ? (
                    <Badge tone="stone">{formatRupees(tractor.pricing.hourlyRate)}/hr</Badge>
                  ) : null}
                  {tractor.pricing.acreEnabled ? (
                    <Badge tone="stone">{formatRupees(tractor.pricing.acreRate)}/acre</Badge>
                  ) : null}
                  {tractor.pricing.tripEnabled ? (
                    <Badge tone="stone">{formatRupees(tractor.pricing.tripRate)}/trip</Badge>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="p-4">
                <p className="text-xs text-stone">{t("app.listTractorBody")}</p>
                <Link href="/owner/tractor" className={buttonStyles("primary", "sm", "mt-3")}>
                  <Plus className="size-3.5" /> {t("app.ownerTractorAdd")}
                </Link>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-forest">{t("app.upcomingJobs")}</h2>
              <Link href="/bookings" className="text-[0.65rem] font-semibold text-forest hover:text-clay">
                {t("common.viewAll")} →
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-xs text-stone">{t("app.noUpcomingJobs")}</p>
            ) : (
              <div className="mt-3 space-y-2">
                {upcoming.slice(0, 3).map((booking) => (
                  <Link
                    key={booking.id}
                    href={`/bookings/${booking.id}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-line/70 px-3 py-2.5 transition hover:border-forest/25"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-forest">
                        {booking.farmer.name} · {booking.serviceLocation.village}
                      </p>
                      <p className="text-[0.62rem] text-stone">
                        {relativeDay(booking.bookingDate)} · {booking.startTime} ·{" "}
                        {booking.tractor.brand} {booking.tractor.model}
                      </p>
                    </div>
                    <StatusBadge status={booking.status} role="owner" />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-display text-xl text-forest">{t("app.recentPayments")}</h2>
            <p className="text-xs text-stone">{t("app.ownerPaymentsSub")}</p>
          </div>
          <Link href="/owner/payments" className="text-xs font-semibold text-forest hover:text-clay">
            {t("common.viewAll")} →
          </Link>
        </div>
        {payments.length === 0 ? (
          <EmptyState
            icon={<Wallet className="size-5" />}
            title={t("app.noPaymentsRecorded")}
            body={t("app.noPaymentsRecordedBody")}
          />
        ) : (
          <Card className="divide-y divide-line/70">
            {payments.map(({ booking, payment }) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-xl",
                      payment.paymentStatus === "confirmed"
                        ? "bg-forest/8 text-forest"
                        : "bg-wheat/30 text-[#7a5a1d]",
                    )}
                  >
                    {payment.paymentStatus === "confirmed" ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <Clock3 className="size-4" />
                    )}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-forest">
                      {booking.farmer.name} · {booking.id}
                    </p>
                    <p className="text-[0.62rem] text-stone">
                      {payment.paymentStatus === "confirmed"
                        ? t("app.markedDoneByOwner")
                        : t("app.paymentNote")}{" "}
                      · {formatDateTime(payment.confirmedAt ?? payment.paidAt)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg text-forest">{formatRupees(payment.amount)}</p>
                  <p className="text-[0.6rem] text-stone">
                    {payment.paymentStatus === "confirmed"
                      ? t("app.received")
                      : t("app.awaitingYourConfirmation")}
                  </p>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

function OwnerActiveJob({
  booking,
  onUpdated,
}: {
  booking: BookingDetail;
  onUpdated: () => void;
}) {
  const { t, serviceLabel } = useI18n();
  const { minutes, breakMinutes } = useWorkMinutes(booking);
  return (
    <Card className="overflow-hidden">
      <div className="bg-forest px-5 py-4 text-cream">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-wheat/80">
            {t("app.todayWork")}
          </span>
          <StatusBadge status={booking.status} role="owner" className="!border-cream/15 !bg-cream/10 !text-cream" />
        </div>
        <h2 className="mt-2 font-display text-2xl text-cream">
          {serviceLabel(booking.serviceType)} · {booking.farmer.name}
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] text-cream/55">
          <span>{booking.tractor.brand} {booking.tractor.model}</span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" /> {booking.serviceLocation.label}
          </span>
          <span>{booking.id}</span>
        </p>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-forest/6 px-3 py-2.5">
            <p className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-stone">{t("app.activeLabel")}</p>
            <p className="mt-0.5 font-display text-lg text-forest">{minutesToHoursLabel(minutes)}</p>
          </div>
          <div className="rounded-xl bg-sand/50 px-3 py-2.5">
            <p className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-stone">{t("app.breakLabel")}</p>
            <p className="mt-0.5 font-display text-lg text-forest">{minutesToHoursLabel(breakMinutes)}</p>
          </div>
          <div className="rounded-xl bg-forest/6 px-3 py-2.5">
            <p className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-stone">{t("app.rateLabel")}</p>
            <p className="mt-0.5 font-display text-lg text-forest">{formatRupees(booking.agreedRate)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Link href={`/bookings/${booking.id}`} className={buttonStyles("outline", "sm")}>
            {t("app.openActiveJob")}
          </Link>
          <BookingActions booking={booking} role="owner" onUpdated={onUpdated} />
        </div>
      </div>
    </Card>
  );
}
