"use client";

import Link from "next/link";
import useSWR from "swr";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  HandCoins,
  Info,
  MapPin,
  MessageSquare,
  Phone,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  BookingActions,
  BookingHistory,
  PaymentMethodLabel,
  WorkSummary,
  useWorkMinutes,
} from "@/components/app/booking-actions";
import { LiveLocationCard } from "@/components/app/live-location-card";
import { Photo } from "@/components/ui/photo";
import {
  Alert,
  Avatar,
  Badge,
  buttonStyles,
  Card,
  EmptyState,
  Skeleton,
  StatusBadge,
} from "@/components/ui/primitives";
import { useToast } from "@/components/providers/app-providers";
import { PRICING_LABELS, PRICING_UNITS, STATUS_META } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { billFormula, formatRupees, minutesToHoursLabel } from "@/lib/pricing";
import type { BookingDetail, BookingStatus, Role } from "@/lib/types";
import { cn, formatDate, formatDateTime, maskMobile } from "@/lib/utils";

const CONTACT_STATUSES: BookingStatus[] = [
  "ACCEPTED",
  "SCHEDULED",
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETION_PENDING",
  "BILL_GENERATED",
  "PAYMENT_PENDING",
  "PAID",
  "COMPLETED",
  "DISPUTED",
];

function CopyButton({ value, label }: { value: string; label: string }) {
  const { push } = useToast();
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          push(`${label} copied.`, "success");
        } catch {
          push("Could not copy. Please select the text manually.", "error");
        }
      }}
      className="inline-flex items-center gap-1 rounded-lg border border-line bg-paper px-2 py-1 text-[0.62rem] font-semibold text-forest transition hover:border-forest/30"
    >
      <Copy className="size-3" /> Copy
    </button>
  );
}

function StatusBanner({ booking, role }: { booking: BookingDetail; role: Role }) {
  const { t } = useI18n();
  const { minutes } = useWorkMinutes(booking);
  const status = booking.status;
  const meta = STATUS_META[status];

  const tone =
    status === "PAUSED" || status === "PAYMENT_PENDING" || status === "BILL_GENERATED"
      ? "border-wheat/70 bg-wheat/20 text-[#6d5118]"
      : status === "DISPUTED"
        ? "border-clay/25 bg-clay/8 text-clay-dark"
        : status === "PENDING" || status === "COMPLETION_PENDING"
          ? "border-sky/20 bg-sky/8 text-sky"
          : status === "REJECTED" ||
              status.startsWith("CANCELLED") ||
              status === "EXPIRED"
            ? "border-line bg-sand/50 text-stone"
            : "border-forest/15 bg-forest/6 text-forest";

  return (
    <div className={cn("rounded-2xl border px-4 py-3.5", tone)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5">
            {status === "PAUSED" ? (
              <Clock3 className="size-4" />
            ) : status === "DISPUTED" ? (
              <ShieldAlert className="size-4" />
            ) : status === "COMPLETED" || status === "PAID" ? (
              <CheckCircle2 className="size-4" />
            ) : status === "PAYMENT_PENDING" || status === "BILL_GENERATED" ? (
              <HandCoins className="size-4" />
            ) : (
              <Info className="size-4" />
            )}
          </span>
          <div>
            <p className="text-sm font-bold">{role === "owner" ? meta.ownerLabel : t(`status.${status}`)}</p>
            <p className="mt-0.5 text-[0.7rem] leading-relaxed opacity-80">
              {status === "PAUSED"
                ? `Break time is recorded separately and not billed. ${minutesToHoursLabel(minutes)} active so far.`
                : status === "IN_PROGRESS"
                  ? `Active work is being recorded. ${minutesToHoursLabel(minutes)} active so far; pauses are not billed.`
                  : status === "PAYMENT_PENDING"
                    ? role === "owner"
                      ? `The final bill is ${formatRupees(booking.finalAmount)}. Mark payment done only after checking your own UPI app, bank account or cash.`
                      : `The final bill is ${formatRupees(booking.finalAmount)}. Pay the owner directly outside KisanTractor. The owner will mark the payment done after receiving it.`
                    : status === "BILL_GENERATED"
                      ? role === "owner"
                        ? "The final bill is ready. Share it with the farmer and mark payment done only after the money reaches you."
                        : "The final bill is ready. Review the amount and pay the owner directly."
                      : status === "PENDING"
                        ? role === "owner"
                          ? "This request is waiting for your decision. Accept only if you can commit to the time."
                          : "Your request has been sent. The tractor owner must accept before work is scheduled."
                        : meta.hint}
            </p>
          </div>
        </div>
        <StatusBadge status={status} role={role} className="shrink-0" />
      </div>
    </div>
  );
}

export function BookingDetailScreen({ bookingId, role }: { bookingId: string; role: Role }) {
  const { t, serviceLabel } = useI18n();
  const { data, error, isLoading, mutate } = useSWR<{ booking: BookingDetail }>(
    `/api/bookings/${bookingId}`,
    { refreshInterval: 10000 },
  );
  const booking = data?.booking;
  const { minutes } = useWorkMinutes(
    booking ?? ({ status: "PENDING", workSession: null } as unknown as BookingDetail),
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-4 lg:grid-cols-[1.5fr_0.75fr]">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <EmptyState
        icon={<AlertTriangle className="size-5" />}
        title="Booking not found"
        body={error instanceof Error ? error.message : "This booking is not available."}
        action={
          <Link href="/bookings" className={buttonStyles("primary", "sm")}>
            Back to bookings
          </Link>
        }
      />
    );
  }

  const isFarmer = role === "farmer";
  const otherParty = isFarmer ? booking.owner : booking.farmer;
  const contactVisible = CONTACT_STATUSES.includes(booking.status);
  const confirmedPayments = booking.payments.filter(
    (payment) => payment.paymentStatus === "confirmed",
  );
  const recordedPayments = booking.payments.filter(
    (payment) => payment.paymentStatus !== "confirmed",
  );
  const receivedAmount = confirmedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const finalAmount = booking.finalAmount;
  const billableMinutes =
    booking.measurement?.billableMinutes ??
    (booking.pricingType === "hourly" ? minutes : null);
  const quantity = {
    minutes: billableMinutes,
    acres: booking.measurement?.completedAcres,
    trips: booking.measurement?.completedTrips,
  };
  const showBill = finalAmount !== null || ["COMPLETED", "PAID", "DISPUTED"].includes(booking.status);
  const paymentDetails = booking.ownerProfile.payment;
  const hasPaymentDetails =
    (paymentDetails.shareUpi && paymentDetails.upiId) ||
    (paymentDetails.shareQr && paymentDetails.qrImage) ||
    (paymentDetails.shareBank && paymentDetails.bankAccountNumber);
  const active =
    booking.status === "IN_PROGRESS" ||
    booking.status === "PAUSED" ||
    booking.status === "COMPLETION_PENDING";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/bookings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone transition hover:text-forest"
        >
          <ArrowLeft className="size-3.5" /> Back to bookings
        </Link>
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-stone/60">
          {t("app.bookingId")} · {booking.id}
        </span>
      </div>

      <Card className="overflow-hidden">
        <div className="relative">
          <Photo
            src={booking.tractor.image}
            alt={`${booking.tractor.brand} ${booking.tractor.model}`}
            className="h-32 w-full sm:h-40"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-4 sm:p-5">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge
                  status={booking.status}
                  role={role}
                  className="!border-cream/20 !bg-cream/15 !text-cream"
                />
                {booking.bookingFor === "other" ? (
                  <Badge tone="clay" className="!border-cream/20 !bg-cream/15 !text-cream">
                    {t("app.forRecipient", { name: booking.recipientName ?? "someone else" })}
                  </Badge>
                ) : null}
              </div>
              <h1 className="mt-1.5 font-display text-2xl text-cream sm:text-3xl">
                {serviceLabel(booking.serviceType)} · {booking.tractor.brand}{" "}
                {booking.tractor.model}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] text-cream/65">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3" /> {formatDate(booking.bookingDate)} ·{" "}
                  {booking.startTime}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" /> {booking.serviceLocation.village}
                </span>
                <span className="inline-flex items-center gap-1">
                  <UserRound className="size-3" />{" "}
                  {isFarmer ? booking.owner.name : booking.farmer.name}
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-cream/15 bg-cream/10 px-3 py-2 text-right backdrop-blur">
              <p className="text-[0.55rem] font-bold uppercase tracking-[0.14em] text-cream/55">
                {finalAmount !== null ? t("common.bill") : t("common.estimated")}
              </p>
              <p className="font-display text-2xl text-cream">
                {formatRupees(finalAmount ?? booking.estimatedAmount)}
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <StatusBanner booking={booking} role={role} />
          <BookingActions booking={booking} role={role} onUpdated={() => mutate()} />
          {active ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-forest/6 px-3 py-2.5">
                <p className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-stone">
                  {t("app.activeWork")}
                </p>
                <p className="mt-0.5 font-display text-lg text-forest">
                  {minutesToHoursLabel(minutes)}
                </p>
              </div>
              <div className="rounded-xl bg-sand/50 px-3 py-2.5">
                <p className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-stone">
                  {t("app.breakTime")}
                </p>
                <p className="mt-0.5 font-display text-lg text-forest">
                  {minutesToHoursLabel(
                    Math.max(
                      0,
                      Math.round(
                        (new Date().getTime() -
                          new Date(
                            booking.workSession?.segments[0]?.start ?? new Date().toISOString(),
                          ).getTime()) /
                          60000,
                      ) - minutes,
                    ),
                  )}
                </p>
              </div>
              <div className="rounded-xl bg-forest/6 px-3 py-2.5">
                <p className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-stone">
                  {t("app.agreedRate")}
                </p>
                <p className="mt-0.5 font-display text-lg text-forest">
                  {formatRupees(booking.agreedRate)}
                  <span className="text-[0.55rem] font-normal text-stone">
                    {PRICING_UNITS[booking.pricingType]}
                  </span>
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.45fr_0.75fr] lg:items-start">
        <div className="space-y-4">
          <LiveLocationCard
            booking={booking}
            role={role}
            onUpdated={() => mutate()}
          />

          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="eyebrow">{t("app.workRecord")}</p>
                <h2 className="mt-1.5 font-display text-xl text-forest">
                  {booking.pricingType === "hourly"
                    ? t("app.workTimeline")
                    : booking.pricingType === "acre"
                      ? "Measured area"
                      : "Completed trips"}
                </h2>
              </div>
              <Badge tone="stone">{PRICING_LABELS[booking.pricingType]}</Badge>
            </div>
            <div className="mt-3">
              <WorkSummary booking={booking} />
            </div>
            {booking.pricingType === "hourly" ? (
              <p className="mt-3 flex items-start gap-1.5 text-[0.65rem] leading-relaxed text-stone">
                <Info className="mt-0.5 size-3 shrink-0" />
                Only active work segments are billed. Time while work is paused is shown separately
                and excluded from the final bill.
              </p>
            ) : null}
          </Card>

          {showBill ? (
            <Card className="overflow-hidden">
              <div className="border-b border-line/80 px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="eyebrow">Final Bill Amount</p>
                    <p className="mt-1 font-display text-3xl text-forest">
                      {formatRupees(finalAmount ?? booking.estimatedAmount)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-cream/60 px-3 py-2 text-right">
                    <p className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-stone">
                      Payment Received
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 font-display text-xl",
                        receivedAmount > 0 ? "text-forest" : "text-clay-dark",
                      )}
                    >
                      {formatRupees(receivedAmount)}
                    </p>
                    <p className="text-[0.58rem] text-stone">
                      {confirmedPayments.length > 0
                        ? "Confirmed by owner"
                        : recordedPayments.length > 0
                          ? "Awaiting owner confirmation"
                          : "Not yet confirmed"}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.65rem] text-stone">
                  <span>
                    {formatRupees(booking.agreedRate)}
                    {PRICING_UNITS[booking.pricingType]} · {PRICING_LABELS[booking.pricingType]}
                  </span>
                  <span className="size-1 rounded-full bg-line" />
                  <span>
                    {billFormula(booking.pricingType, booking.agreedRate, quantity)}
                  </span>
                </div>
              </div>
              <div className="px-4 py-3.5 sm:px-5">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-stone">
                  Payment records
                </p>
                {booking.payments.length === 0 ? (
                  <p className="mt-2 text-xs leading-relaxed text-stone">
                    No payment has been recorded yet. The final bill is separate from payment
                    received; only the owner confirms receipt.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {booking.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/70 bg-cream/40 px-3 py-2.5"
                      >
                        <div className="flex items-start gap-2.5">
                          <span
                            className={cn(
                              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                              payment.paymentStatus === "confirmed"
                                ? "bg-forest/10 text-forest"
                                : "bg-wheat/40 text-[#7a5a1d]",
                            )}
                          >
                            {payment.paymentStatus === "confirmed" ? (
                              <BadgeCheck className="size-3.5" />
                            ) : (
                              <Clock3 className="size-3.5" />
                            )}
                          </span>
                          <div>
                            <p className="text-xs font-semibold text-forest">
                              {formatRupees(payment.amount)} ·{" "}
                              <PaymentMethodLabel method={payment.paymentMethod} />
                            </p>
                            <p className="text-[0.62rem] text-stone">
                              {payment.paymentStatus === "confirmed"
                                ? `Confirmed ${formatDateTime(payment.confirmedAt ?? payment.paidAt)}`
                                : `Recorded ${formatDateTime(payment.paidAt)} · awaiting owner confirmation`}
                            </p>
                            {payment.notes ? (
                              <p className="mt-0.5 text-[0.62rem] text-stone/80">{payment.notes}</p>
                            ) : null}
                          </div>
                        </div>
                        <Badge
                          tone={payment.paymentStatus === "confirmed" ? "green" : "amber"}
                          dot
                        >
                          {payment.paymentStatus === "confirmed" ? "Received" : "Recorded"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 rounded-xl border border-dashed border-line bg-paper px-3.5 py-3">
                  <p className="flex items-start gap-1.5 text-[0.65rem] leading-relaxed text-stone">
                    <ShieldCheck className="mt-0.5 size-3 shrink-0 text-forest" />
                    <span>
                      <strong className="text-forest">Final Bill Amount</strong> is what the owner
                      calculated for the work.{" "}
                      <strong className="text-forest">Payment Received</strong> is confirmed only
                      after the owner checks their own UPI app, bank account or cash. KisanTractor
                      does not collect this money.
                    </span>
                  </p>
                </div>
              </div>
            </Card>
          ) : null}

          {booking.dispute ? (
            <Card className="border-clay/20 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-clay/10 text-clay-dark">
                    <ShieldAlert className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-clay-dark">{booking.dispute.reason}</p>
                    <p className="mt-1 text-xs leading-relaxed text-stone">
                      {booking.dispute.details}
                    </p>
                  </div>
                </div>
                <Badge tone={booking.dispute.status === "resolved" ? "green" : "red"} dot>
                  {booking.dispute.status === "resolved" ? "Resolved" : "Under review"}
                </Badge>
              </div>
              <p className="mt-3 text-[0.62rem] text-stone">
                Reported by {booking.dispute.raisedByRole} ·{" "}
                {formatDateTime(booking.dispute.createdAt)}
              </p>
              <p className="mt-2 text-[0.65rem] leading-relaxed text-stone">
                The original booking, work sessions, final bill and payment records are preserved.
              </p>
            </Card>
          ) : null}

          <Card className="p-4 sm:p-5">
            <h2 className="font-display text-xl text-forest">Booking details</h2>
            <dl className="mt-3 space-y-2.5 text-xs">
              <div className="flex items-start justify-between gap-3 border-b border-line/60 pb-2.5">
                <dt className="text-stone">{t("common.service")}</dt>
                <dd className="text-right font-semibold text-forest">
                  {serviceLabel(booking.serviceType)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-b border-line/60 pb-2.5">
                <dt className="text-stone">{t("common.tractor")}</dt>
                <dd className="text-right font-semibold text-forest">
                  {booking.tractor.brand} {booking.tractor.model}
                  <span className="block text-[0.62rem] font-normal text-stone">
                    {booking.tractor.registrationNumber} · {booking.tractor.horsepower} HP
                  </span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-b border-line/60 pb-2.5">
                <dt className="text-stone">{t("common.date")}</dt>
                <dd className="text-right font-semibold text-forest">
                  {formatDate(booking.bookingDate)} · {booking.startTime}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-b border-line/60 pb-2.5">
                <dt className="text-stone">{t("app.serviceLocation")}</dt>
                <dd className="max-w-[62%] text-right font-semibold text-forest">
                  {booking.serviceLocation.label}
                  <span className="block text-[0.62rem] font-normal text-stone">
                    {booking.serviceLocation.village}, {booking.serviceLocation.district},{" "}
                    {booking.serviceLocation.state}
                  </span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-b border-line/60 pb-2.5">
                <dt className="text-stone">{t("app.agreedRate")}</dt>
                <dd className="text-right font-semibold text-forest">
                  {formatRupees(booking.agreedRate)}
                  {PRICING_UNITS[booking.pricingType]}
                </dd>
              </div>
              {booking.bookingFor === "other" ? (
                <div className="flex items-start justify-between gap-3 border-b border-line/60 pb-2.5">
                  <dt className="text-stone">Booked for</dt>
                  <dd className="text-right font-semibold text-forest">
                    {booking.recipientName}
                    <span className="block text-[0.62rem] font-normal text-stone">
                      {contactVisible
                        ? `+91 ${booking.recipientMobile}`
                        : maskMobile(booking.recipientMobile ?? "")}
                    </span>
                  </dd>
                </div>
              ) : null}
              {booking.note ? (
                <div className="flex items-start justify-between gap-3 border-b border-line/60 pb-2.5">
                  <dt className="text-stone">{t("common.notes")}</dt>
                  <dd className="max-w-[62%] text-right text-forest/85">{booking.note}</dd>
                </div>
              ) : null}
              {booking.serviceLocation.note ? (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-stone">Farm note</dt>
                  <dd className="max-w-[62%] text-right text-forest/85">
                    {booking.serviceLocation.note}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="font-display text-xl text-forest">Status history</h2>
            <p className="mt-1 text-xs text-stone">
              Every change is recorded by the backend with who made it and why.
            </p>
            <div className="mt-3">
              <BookingHistory booking={booking} />
            </div>
          </Card>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24">
          <Card className="p-4">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-stone">
              {isFarmer ? t("common.owner") : t("common.farmer")}
            </p>
            <div className="mt-2.5 flex items-center gap-3">
              <Avatar name={otherParty.name} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-display text-xl text-forest">{otherParty.name}</p>
                <p className="mt-0.5 text-[0.68rem] text-stone">
                  {isFarmer
                    ? `Tractor owner · ${booking.ownerProfile.village}`
                    : `Farmer · ${booking.serviceLocation.village}`}
                </p>
                <Badge tone={contactVisible ? "green" : "stone"} dot className="mt-1">
                  {contactVisible ? "Contact available" : "Contact after acceptance"}
                </Badge>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-line bg-cream/40 px-3.5 py-3">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-stone">
                {t("common.phone")}
              </p>
              <p className="mt-0.5 text-sm font-semibold tracking-[0.04em] text-forest">
                {contactVisible ? `+91 ${otherParty.mobile}` : maskMobile(otherParty.mobile)}
              </p>
              {contactVisible ? (
                <a
                  href={`tel:+91${otherParty.mobile}`}
                  className={buttonStyles("primary", "sm", "mt-2.5 w-full")}
                >
                  <Phone className="size-3.5" /> {t("app.call")} {otherParty.name.split(" ")[0]}
                </a>
              ) : (
                <p className="mt-1.5 text-[0.65rem] leading-relaxed text-stone">
                  {t("app.contactAfterAccept")}
                </p>
              )}
            </div>
            {booking.bookingFor === "other" && contactVisible ? (
              <div className="mt-2 rounded-xl border border-clay/15 bg-clay/5 px-3.5 py-2.5">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-stone">
                  Recipient
                </p>
                <p className="mt-0.5 text-xs font-semibold text-forest">
                  {booking.recipientName} · +91 {booking.recipientMobile}
                </p>
              </div>
            ) : null}
            <p className="mt-3 flex items-start gap-1.5 text-[0.62rem] leading-relaxed text-stone">
              <MessageSquare className="mt-0.5 size-3 shrink-0" />
              Use the number for work coordination only. Do not share bank OTPs, UPI PINs or
              passwords with anyone.
            </p>
          </Card>

          {isFarmer && finalAmount !== null ? (
            <Card className="overflow-hidden">
              <div className="border-b border-line/80 bg-wheat/15 px-4 py-3">
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#7a5a1d]">
                  Pay {booking.owner.name} directly
                </p>
                <p className="mt-0.5 text-[0.65rem] text-[#7a5a1d]">
                  Pay outside KisanTractor, then record the method used.
                </p>
              </div>
              <div className="space-y-2 p-4">
                {hasPaymentDetails ? (
                  <>
                    {paymentDetails.shareUpi && paymentDetails.upiId ? (
                      <div className="rounded-xl border border-line bg-cream/40 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-stone">
                            {t("app.upiId")}
                          </p>
                          <CopyButton value={paymentDetails.upiId} label="UPI ID" />
                        </div>
                        <p className="mt-1 text-sm font-semibold text-forest">
                          {paymentDetails.upiId}
                        </p>
                      </div>
                    ) : null}
                    {paymentDetails.shareQr && paymentDetails.qrImage ? (
                      <Photo
                        src={paymentDetails.qrImage}
                        alt="Owner payment QR"
                        className="mx-auto h-40 w-40 rounded-xl border border-line"
                        sizes="160px"
                      />
                    ) : null}
                    {paymentDetails.shareBank && paymentDetails.bankAccountNumber ? (
                      <div className="rounded-xl border border-line bg-cream/40 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-stone">
                            {t("app.bankDetails")}
                          </p>
                          <CopyButton
                            value={paymentDetails.bankAccountNumber}
                            label="Account number"
                          />
                        </div>
                        <p className="mt-1 text-xs font-semibold text-forest">
                          {paymentDetails.bankAccountName}
                        </p>
                        <p className="text-xs text-forest">
                          A/c {paymentDetails.bankAccountNumber}
                        </p>
                        <p className="text-[0.65rem] text-stone">IFSC {paymentDetails.bankIfsc}</p>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed border-line px-3 py-3 text-[0.68rem] leading-relaxed text-stone">
                    {t("app.noPaymentDetails")} {t("app.askOwner")}
                  </div>
                )}
                <Alert tone="warning">{t("app.paymentNotReceipt")} {t("app.onlyOwnerConfirm")}</Alert>
              </div>
            </Card>
          ) : null}

          <div className="rounded-2xl border border-line/70 bg-paper/60 p-4">
            <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-stone">
              <ReceiptText className="size-3.5" /> Booking record
            </p>
            <div className="mt-2 space-y-1.5 text-[0.65rem] text-stone">
              <p className="flex items-center justify-between gap-2">
                <span>Booking ID</span>
                <span className="font-semibold text-forest">{booking.id}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>Requested</span>
                <span className="font-semibold text-forest">
                  {formatDateTime(booking.createdAt)}
                </span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>Last update</span>
                <span className="font-semibold text-forest">
                  {formatDateTime(booking.updatedAt)}
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-forest/10 bg-forest/5 p-4">
            <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-forest">
              <Wallet className="size-3.5" /> No commission
            </p>
            <p className="mt-1.5 text-[0.66rem] leading-relaxed text-forest/75">
              KisanTractor holds no money and takes no commission. Farmers pay tractor owners
              directly. The platform only records the booking, work and payment confirmation.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
