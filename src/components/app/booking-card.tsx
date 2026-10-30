"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Tractor, UserRound } from "lucide-react";
import { Photo } from "@/components/ui/photo";
import { Badge, StatusBadge } from "@/components/ui/primitives";
import { BookingActions, useWorkMinutes } from "@/components/app/booking-actions";
import { PRICING_LABELS, PRICING_UNITS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { formatRupees, minutesToHoursLabel } from "@/lib/pricing";
import type { BookingDetail, Role } from "@/lib/types";
import { cn, relativeDay } from "@/lib/utils";

export function BookingCard({
  booking,
  role,
  showActions = false,
  compact = false,
  onUpdated,
}: {
  booking: BookingDetail;
  role: Role;
  showActions?: boolean;
  compact?: boolean;
  onUpdated?: (booking: BookingDetail) => void;
}) {
  const { t, serviceLabel } = useI18n();
  const { minutes } = useWorkMinutes(booking);
  const active =
    booking.status === "IN_PROGRESS" ||
    booking.status === "PAUSED" ||
    booking.status === "COMPLETION_PENDING";
  const amount = booking.finalAmount ?? booking.estimatedAmount;
  const otherParty = role === "farmer" ? booking.owner : booking.farmer;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.4rem] border border-line/80 bg-paper shadow-[var(--shadow-card)]",
        compact && "rounded-2xl",
      )}
    >
      <div className={cn("flex flex-col gap-4 p-4 sm:flex-row sm:items-start", !compact && "sm:p-5")}>
        <Photo
          src={booking.tractor.image}
          alt={`${booking.tractor.brand} ${booking.tractor.model}`}
          className={cn(
            "h-32 w-full shrink-0 rounded-xl sm:w-36",
            compact && "h-24 sm:h-24 sm:w-28",
          )}
          sizes="150px"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={booking.status} role={role} />
              {booking.bookingFor === "other" ? (
                <Badge tone="clay">For {booking.recipientName}</Badge>
              ) : null}
              {active ? (
                <Badge tone="blue" dot>
                  {minutesToHoursLabel(minutes)} active
                </Badge>
              ) : null}
            </div>
            <span className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-stone/60">
              {booking.id}
            </span>
          </div>

          <div className="mt-2.5">
            <h3 className="font-display text-xl leading-tight text-forest">
              {serviceLabel(booking.serviceType)} ·{" "}
              <span className="text-forest/70">{booking.tractor.brand} {booking.tractor.model}</span>
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-stone">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3" />
                {relativeDay(booking.bookingDate)} · {booking.startTime}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" />
                {booking.serviceLocation.village}
              </span>
              <span className="inline-flex items-center gap-1">
                {role === "farmer" ? (
                  <>
                    <Tractor className="size-3" /> {booking.owner.name}
                  </>
                ) : (
                  <>
                    <UserRound className="size-3" /> {booking.farmer.name}
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.68rem]">
              <span className="text-stone">
                {PRICING_LABELS[booking.pricingType]} ·{" "}
                <span className="font-semibold text-forest">
                  {formatRupees(booking.agreedRate)}
                  {PRICING_UNITS[booking.pricingType]}
                </span>
              </span>
              <span className="text-stone">
                {booking.finalAmount !== null ? t("common.bill") : t("common.estimated")}:{" "}
                <span className="font-semibold text-forest">{formatRupees(amount)}</span>
              </span>
            </div>
            <Link
              href={`/bookings/${booking.id}`}
              className="inline-flex items-center gap-1 text-[0.7rem] font-semibold text-forest hover:text-clay"
            >
              {t("common.viewDetails")} <ArrowRight className="size-3" />
            </Link>
          </div>

          {showActions ? (
            <div className="mt-3 border-t border-line/70 pt-3">
              <BookingActions booking={booking} role={role} onUpdated={onUpdated} />
            </div>
          ) : null}
        </div>
      </div>

      {!compact && booking.status === "PAYMENT_PENDING" && role === "owner" ? (
        <div className="border-t border-wheat/50 bg-wheat/15 px-4 py-2 text-[0.68rem] font-medium text-[#7a5a1d] sm:px-5">
          Confirm only after you receive {formatRupees(booking.finalAmount)} directly from {otherParty.name}.
        </div>
      ) : null}
    </div>
  );
}
