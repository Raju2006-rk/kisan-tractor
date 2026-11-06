"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Compass,
  Search,
  Tractor,
  Wallet,
  X,
} from "lucide-react";
import { BookingCard } from "@/components/app/booking-card";
import {
  Badge,
  buttonStyles,
  EmptyState,
  SegmentedControl,
  Skeleton,
} from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import type { BookingDetail, BookingStatus, Role } from "@/lib/types";

type Tab = "requests" | "active" | "upcoming" | "history";

const ACTIVE: BookingStatus[] = [
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETION_PENDING",
  "BILL_GENERATED",
  "PAYMENT_PENDING",
  "PAID",
];
const UPCOMING: BookingStatus[] = ["PENDING", "ACCEPTED", "SCHEDULED"];
const HISTORY: BookingStatus[] = [
  "COMPLETED",
  "REJECTED",
  "CANCELLED_BY_FARMER",
  "CANCELLED_BY_OWNER",
  "EXPIRED",
  "DISPUTED",
];

export function BookingsScreen({ role }: { role: Role }) {
  const { t } = useI18n();
  const { data, isLoading, mutate } = useSWR<{ bookings: BookingDetail[] }>(
    "/api/bookings",
    { refreshInterval: 20000 },
  );
  const isOwner = role === "owner";
  const [tab, setTab] = useState<Tab>(isOwner ? "requests" : "active");
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const bookings = data?.bookings ?? [];
    const filtered = query.trim()
      ? bookings.filter((booking) => {
          const haystack = [
            booking.id,
            booking.farmer.name,
            booking.owner.name,
            booking.tractor.brand,
            booking.tractor.model,
            booking.serviceLocation.village,
            booking.serviceLocation.label,
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(query.trim().toLowerCase());
        })
      : bookings;

    return {
      requests: filtered.filter((booking) => booking.status === "PENDING"),
      active: filtered.filter((booking) => ACTIVE.includes(booking.status)),
      upcoming: filtered.filter((booking) => UPCOMING.includes(booking.status)),
      history: filtered.filter((booking) => HISTORY.includes(booking.status)),
    } satisfies Record<Tab, BookingDetail[]>;
  }, [data, query]);

  const options = isOwner
    ? [
        { value: "requests" as const, label: t("app.requestsTab"), count: groups.requests.length },
        { value: "active" as const, label: t("common.active"), count: groups.active.length },
        { value: "upcoming" as const, label: t("app.upcomingTab"), count: groups.upcoming.length },
        { value: "history" as const, label: t("app.historyTab"), count: groups.history.length },
      ]
    : [
        { value: "active" as const, label: t("common.active"), count: groups.active.length },
        { value: "upcoming" as const, label: t("app.upcomingTab"), count: groups.upcoming.length },
        { value: "history" as const, label: t("app.historyTab"), count: groups.history.length },
      ];

  const visible = groups[tab];

  const emptyCopy: Record<Tab, { title: string; body: string }> = {
    requests: {
      title: t("app.noNewRequests"),
      body: t("app.noNewRequestsBody"),
    },
    active: {
      title: t("app.noActiveWork"),
      body: isOwner
        ? t("app.noActiveOwnerBody")
        : t("app.noActiveFarmerBody"),
    },
    upcoming: {
      title: t("app.nothingUpcoming"),
      body: isOwner
        ? t("app.nothingUpcomingOwnerBody")
        : t("app.nothingUpcomingFarmerBody"),
    },
    history: {
      title: t("app.noPastBookings"),
      body: t("app.noPastBookingsBody"),
    },
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="green" dot>
              {isOwner ? t("app.ownerTag") : t("app.farmerTag")}
            </Badge>
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-stone/70">
              {t("app.bookingRecords")}
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl text-forest sm:text-[2.4rem]">
            {t("app.bookingsTitle")}
          </h1>
          <p className="mt-1 text-sm text-stone">{t("app.bookingsSub")}</p>
        </div>
        {isOwner ? (
          <Link href="/owner/tractor" className={buttonStyles("primary", "md")}>
            <Tractor className="size-4" /> {t("app.manageTractor")}
          </Link>
        ) : (
          <Link href="/explore" className={buttonStyles("primary", "md")}>
            <Compass className="size-4" /> {t("app.findTractorTitle")}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(isOwner
          ? [
              {
                label: t("app.ownerRequests"),
                value: groups.requests.length,
                icon: CalendarDays,
                tone: "bg-clay/10 text-clay-dark",
              },
              {
                label: t("common.active"),
                value: groups.active.length,
                icon: Clock3,
                tone: "bg-sky/10 text-sky",
              },
              {
                label: t("app.upcomingTab"),
                value: groups.upcoming.length,
                icon: CalendarDays,
                tone: "bg-wheat/40 text-[#7a5a1d]",
              },
              {
                label: t("app.historyTab"),
                value: groups.history.length,
                icon: CheckCircle2,
                tone: "bg-forest/8 text-forest",
              },
            ]
          : [
              {
                label: t("common.active"),
                value: groups.active.length,
                icon: Clock3,
                tone: "bg-sky/10 text-sky",
              },
              {
                label: t("app.upcomingTab"),
                value: groups.upcoming.length,
                icon: CalendarDays,
                tone: "bg-wheat/40 text-[#7a5a1d]",
              },
              {
                label: t("app.historyTab"),
                value: groups.history.length,
                icon: CheckCircle2,
                tone: "bg-forest/8 text-forest",
              },
              {
                label: t("app.paymentDue"),
                value: groups.active.filter((booking) =>
                  ["BILL_GENERATED", "PAYMENT_PENDING"].includes(booking.status),
                ).length,
                icon: Wallet,
                tone: "bg-clay/10 text-clay-dark",
              },
            ]
        ).map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-2xl border border-line/80 bg-paper px-3.5 py-3 shadow-(--shadow-card)"
          >
            <span className={`flex size-9 items-center justify-center rounded-xl ${stat.tone}`}>
              <stat.icon className="size-4" />
            </span>
            <div>
              <p className="font-display text-xl text-forest">{stat.value}</p>
              <p className="text-[0.62rem] font-medium text-stone">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          options={options}
          value={tab}
          onChange={(value) => setTab(value)}
          className="sm:max-w-xl"
        />
        <label className="flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-3.5 sm:w-64">
          <Search className="size-3.5 shrink-0 text-stone/60" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("app.searchBookings")}
            className="min-w-0 flex-1 bg-transparent text-xs text-ink placeholder:text-stone/55 focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("common.clearSearch")}
              className="text-stone/60 hover:text-forest"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </label>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-52 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={
            tab === "history" ? (
              <CheckCircle2 className="size-5" />
            ) : tab === "active" ? (
              <Clock3 className="size-5" />
            ) : (
              <CalendarDays className="size-5" />
            )
          }
          title={emptyCopy[tab].title}
          body={emptyCopy[tab].body}
          action={
            isOwner ? (
              <Link href="/owner/tractor" className={buttonStyles("outline", "sm")}>
                {t("app.manageYourTractor")}
              </Link>
            ) : (
              <Link href="/explore" className={buttonStyles("primary", "sm")}>
                {t("nav.findTractor")} <Compass className="size-3.5" />
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((booking, index) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              role={role}
              showActions
              priority={index === 0}
              onUpdated={() => mutate()}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col items-start justify-between gap-3 rounded-[1.4rem] border border-forest/10 bg-[linear-gradient(120deg,#eaf0e4,#f3ecd9)] p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-forest text-wheat">
            <Wallet className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-forest">
              {t("app.finalBillPaymentSeparate")}
            </p>
            <p className="mt-0.5 max-w-2xl text-[0.7rem] leading-relaxed text-stone">
              {t("common.directPayment")} {t("app.onlyOwnerConfirm")}
            </p>
          </div>
        </div>
        <Link href="/help#billing" className={buttonStyles("outline", "sm", "shrink-0")}>
          {t("app.billingHelp")}
        </Link>
      </div>
    </div>
  );
}
