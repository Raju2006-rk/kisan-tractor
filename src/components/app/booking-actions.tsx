"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import {
  BadgeCheck,
  Check,
  CircleAlert,
  Pause,
  Play,
  ReceiptText,
  ShieldAlert,
  Square,
  TimerReset,
  X,
} from "lucide-react";
import { useToast } from "@/components/providers/app-providers";
import {
  Alert,
  Button,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { PAYMENT_METHODS, PRICING_LABELS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { calculateAmount, formatRupees, minutesToHoursLabel } from "@/lib/pricing";
import type { BookingDetail, PaymentMethod, Role } from "@/lib/types";
import {
  computeActiveMinutes,
  computeBreakMinutes,
  formatDateTime,
  formatTime,
} from "@/lib/utils";

type DialogKind =
  | "accept"
  | "reject"
  | "cancel"
  | "finish"
  | "confirm_payment"
  | "dispute"
  | null;

function useNow(active: boolean) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

export function useWorkMinutes(booking: BookingDetail) {
  const active =
    booking.status === "IN_PROGRESS" ||
    booking.status === "PAUSED" ||
    booking.status === "COMPLETION_PENDING";
  const now = useNow(active);
  return useMemo(() => {
    const segments = booking.workSession?.segments ?? [];
    const minutes = computeActiveMinutes(segments, now);
    const breakMinutes = computeBreakMinutes(
      segments,
      now,
      booking.status === "PAUSED",
    );
    return { minutes, breakMinutes, segments };
  }, [booking.workSession?.segments, booking.status, now]);
}

export function BookingActions({
  booking,
  role,
  onUpdated,
  className,
}: {
  booking: BookingDetail;
  role: Role;
  onUpdated?: (booking: BookingDetail) => void;
  className?: string;
}) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { push } = useToast();
  const { t } = useI18n();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [method, setMethod] = useState<PaymentMethod>(
    booking.ownerProfile.payment.preferredMethod ?? "upi",
  );
  const [notes, setNotes] = useState("");
  const [acres, setAcres] = useState(String(booking.estimatedAcres ?? 1));
  const [trips, setTrips] = useState(String(booking.estimatedTrips ?? 1));
  const [confirmedCheck, setConfirmedCheck] = useState(false);
  const { minutes, breakMinutes } = useWorkMinutes(booking);

  const isOwner = role === "owner";
  const status = booking.status;

  const flags = {
    accept: isOwner && status === "PENDING",
    reject: isOwner && status === "PENDING",
    cancel:
      (isOwner || !isOwner) &&
      ["PENDING", "ACCEPTED", "SCHEDULED"].includes(status),
    start: isOwner && ["ACCEPTED", "SCHEDULED"].includes(status),
    pause: isOwner && status === "IN_PROGRESS",
    resume: isOwner && status === "PAUSED",
    finish: isOwner && ["IN_PROGRESS", "PAUSED"].includes(status),
    confirmPayment: isOwner && status === "PAYMENT_PENDING",
    dispute:
      ["BILL_GENERATED", "PAYMENT_PENDING", "PAID", "COMPLETED", "DISPUTED"].includes(
        status,
      ) && status !== "DISPUTED",
  };

  function open(kind: DialogKind) {
    setDialog(kind);
    setError(null);
    setReason("");
    setDetails("");
    setNotes("");
    setConfirmedCheck(false);
    setAcres(String(booking.measurement?.completedAcres ?? booking.estimatedAcres ?? 1));
    setTrips(String(booking.measurement?.completedTrips ?? booking.estimatedTrips ?? 1));
    setMethod(booking.ownerProfile.payment.preferredMethod ?? "upi");
  }

  async function submit(action: string, payload?: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const data = (await response.json()) as {
        error?: string;
        booking?: BookingDetail;
      };
      if (!response.ok) throw new Error(data.error ?? t("app.couldNotUpdateBooking"));
      push(t("app.bookingUpdated"), "success");
      setDialog(null);
      await mutate((key) => typeof key === "string" && key.startsWith("/api/"));
      if (data.booking) onUpdated?.(data.booking);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("app.couldNotUpdateBooking"));
    } finally {
      setLoading(false);
    }
  }

  const finishEstimate = useMemo(() => {
    if (booking.pricingType === "hourly") {
      return calculateAmount("hourly", booking.agreedRate, { minutes });
    }
    if (booking.pricingType === "acre") {
      return calculateAmount("acre", booking.agreedRate, {
        acres: Number(acres) || 0,
      });
    }
    return calculateAmount("trip", booking.agreedRate, { trips: Number(trips) || 0 });
  }, [booking.pricingType, booking.agreedRate, minutes, acres, trips]);

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {flags.accept ? (
          <Button size="sm" onClick={() => open("accept")}>
            <Check className="size-3.5" /> {t("app.acceptBooking")}
          </Button>
        ) : null}
        {flags.reject ? (
          <Button variant="danger" size="sm" onClick={() => open("reject")}>
            <X className="size-3.5" /> {t("app.rejectRequest")}
          </Button>
        ) : null}
        {flags.start ? (
          <Button size="sm" onClick={() => submit("start")} loading={loading}>
            <Play className="size-3.5" /> {t("app.startJob")}
          </Button>
        ) : null}
        {flags.pause ? (
          <Button variant="secondary" size="sm" onClick={() => submit("pause")} loading={loading}>
            <Pause className="size-3.5" /> {t("app.pauseWork")}
          </Button>
        ) : null}
        {flags.resume ? (
          <Button size="sm" onClick={() => submit("resume")} loading={loading}>
            <Play className="size-3.5" /> {t("app.resumeWork")}
          </Button>
        ) : null}
        {flags.finish ? (
          <Button variant="clay" size="sm" onClick={() => open("finish")}>
            <Square className="size-3.5" /> {t("app.finishWork")}
          </Button>
        ) : null}
        {flags.confirmPayment ? (
          <Button size="sm" onClick={() => open("confirm_payment")}>
            <BadgeCheck className="size-3.5" /> {t("app.confirmPayment")}
          </Button>
        ) : null}
        {flags.cancel ? (
          <Button variant="ghost" size="sm" onClick={() => open("cancel")}>
            {t("app.cancelBooking")}
          </Button>
        ) : null}
        {flags.dispute ? (
          <Button variant="ghost" size="sm" onClick={() => open("dispute")}>
            <ShieldAlert className="size-3.5" /> {t("app.reportIssue")}
          </Button>
        ) : null}
      </div>

      <Modal
        open={dialog === "accept"}
        onClose={() => setDialog(null)}
        title={t("app.acceptConfirm")}
        description={t("app.acceptBody")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {t("common.cancel")}
            </Button>
            <Button loading={loading} onClick={() => submit("accept")}>
              {t("app.yesAccept")}
            </Button>
          </>
        }
      >
        <div className="space-y-3 rounded-2xl border border-line bg-cream/60 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-stone">{t("common.service")}</span>
            <span className="font-semibold text-forest">
              {booking.serviceType} · {PRICING_LABELS[booking.pricingType]}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone">{t("app.workDate")}</span>
            <span className="font-semibold text-forest">
              {booking.bookingDate} · {booking.startTime}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone">{t("app.agreedRate")}</span>
            <span className="font-semibold text-forest">
              {formatRupees(booking.agreedRate)}
              {booking.pricingType === "hourly"
                ? t("common.perHour")
                : booking.pricingType === "acre"
                  ? t("common.perAcre")
                  : t("common.perTrip")}
            </span>
          </div>
        </div>
        {error ? <Alert tone="danger" className="mt-3">{error}</Alert> : null}
      </Modal>

      <Modal
        open={dialog === "reject"}
        onClose={() => setDialog(null)}
        title={t("app.rejectConfirm")}
        description={t("app.rejectBody")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {t("app.keepBooking")}
            </Button>
            <Button
              variant="danger"
              loading={loading}
              onClick={() =>
              submit("reject", {
                reason: reason || t("app.ownerUnavailableReason"),
              })
            }
            >
              {t("app.yesReject")}
            </Button>
          </>
        }
      >
        <Field label={t("app.rejectReason")} hint={t("common.optional")}>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("app.tractorCommittedPlaceholder")}
          />
        </Field>
        {error ? <Alert tone="danger" className="mt-3">{error}</Alert> : null}
      </Modal>

      <Modal
        open={dialog === "cancel"}
        onClose={() => setDialog(null)}
        title={t("app.cancelConfirm")}
        description={t("app.cancelBody")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {t("app.keepBooking")}
            </Button>
            <Button
              variant="danger"
              loading={loading}
              onClick={() =>
                submit("cancel", {
                  reason: reason || t("app.cancelledByUserReason"),
                })
              }
            >
              {t("app.yesCancel")}
            </Button>
          </>
        }
      >
        <Field label={t("app.cancelReason")} hint={t("common.optional")}>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("app.plansChangedPlaceholder")}
          />
        </Field>
        {error ? <Alert tone="danger" className="mt-3">{error}</Alert> : null}
      </Modal>

      <Modal
        open={dialog === "finish"}
        onClose={() => setDialog(null)}
        title={t("app.finishTitle")}
        description={t("app.finishBody")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="clay"
              loading={loading}
              onClick={() =>
                submit("finish", {
                  acres: Number(acres),
                  trips: Number(trips),
                })
              }
            >
              {t("app.submitFinish")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {booking.pricingType === "hourly" ? (
            <div className="rounded-2xl border border-line bg-cream/60 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-stone">
                  <TimerReset className="size-4" /> {t("app.billableActiveTime")}
                </span>
                <span className="font-semibold text-forest">{minutesToHoursLabel(minutes)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-stone">
                <span>{t("app.breakTimeNotBilled")}</span>
                <span>{minutesToHoursLabel(breakMinutes)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
                <span className="font-semibold text-forest">{t("common.estimated")}</span>
                <span className="font-display text-xl text-forest">
                  {formatRupees(finishEstimate)}
                </span>
              </div>
            </div>
          ) : booking.pricingType === "acre" ? (
            <Field
              label={t("app.acresCompleted")}
              hint={`${t("app.agreedRate")} ${formatRupees(booking.agreedRate)}${t("common.perAcre")}`}
            >
              <Input
                type="number"
                min="0.1"
                step="0.1"
                value={acres}
                onChange={(event) => setAcres(event.target.value)}
              />
            </Field>
          ) : (
            <Field
              label={t("app.tripsCompleted")}
              hint={`${t("app.agreedRate")} ${formatRupees(booking.agreedRate)}${t("common.perTrip")}`}
            >
              <Input
                type="number"
                min="1"
                step="1"
                value={trips}
                onChange={(event) => setTrips(event.target.value)}
              />
            </Field>
          )}
          <div className="flex items-center justify-between rounded-2xl bg-forest/5 px-4 py-3">
            <span className="text-sm font-semibold text-forest">{t("common.estimated")}</span>
            <span className="font-display text-2xl text-forest">{formatRupees(finishEstimate)}</span>
          </div>
          <p className="text-xs leading-relaxed text-stone">
            {t("app.rateStaysBody")}
          </p>
        </div>
        {error ? <Alert tone="danger" className="mt-3">{error}</Alert> : null}
      </Modal>

      <Modal
        open={dialog === "confirm_payment"}
        onClose={() => setDialog(null)}
        title={t("app.confirmReceived", {
          amount: (booking.finalAmount ?? 0).toLocaleString("en-IN"),
        })}
        description={t("app.confirmWarning")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              loading={loading}
              disabled={!confirmedCheck}
              onClick={() =>
                submit("confirm_payment", {
                  method,
                  notes: notes || t("app.ownerMarkedPaymentNote"),
                })
              }
            >
              <BadgeCheck className="size-4" /> {t("app.confirmPayment")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-forest/6 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone">{t("app.paymentReceived")}</span>
              <span className="font-display text-2xl text-forest">
                {formatRupees(booking.finalAmount)}
              </span>
            </div>
            <p className="mt-1 text-xs text-stone">
              {t("app.bookedBy", { name: booking.farmer.name })} · {booking.id}
            </p>
          </div>

          {booking.payments.filter((payment) => payment.paymentStatus !== "confirmed").length > 0 ? (
            <div className="rounded-2xl border border-line bg-cream/50 p-4">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-stone">
                {t("app.paymentRecordedEarlier")}
              </p>
              {booking.payments
                .filter((payment) => payment.paymentStatus !== "confirmed")
                .map((payment) => (
                  <p key={payment.id} className="mt-1 text-sm font-semibold text-forest">
                    {PAYMENT_METHODS.find((item) => item.id === payment.paymentMethod)?.label} ·{" "}
                    {formatRupees(payment.amount)} · {formatDateTime(payment.paidAt)}
                  </p>
                ))}
              <p className="mt-2 text-[0.68rem] leading-relaxed text-stone">
                {t("app.ownerConfirmWarning")}
              </p>
            </div>
          ) : null}

          <Field label={t("common.payment")} hint={t("common.optional")}>
            <Select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t("common.notes")} hint={t("common.optional")}>
            <Input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t("app.receivedCashPlaceholder")}
            />
          </Field>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-forest/15 bg-forest/5 p-3.5 text-xs leading-relaxed text-forest">
            <input
              type="checkbox"
              checked={confirmedCheck}
              onChange={(event) => setConfirmedCheck(event.target.checked)}
              className="mt-0.5 size-4 accent-[#163b2a]"
            />
            <span>
              {t("app.confirmReceiptCheckbox", {
                amount: formatRupees(booking.finalAmount),
              })}
            </span>
          </label>
        </div>
        {error ? <Alert tone="danger" className="mt-3">{error}</Alert> : null}
      </Modal>

      <Modal
        open={dialog === "dispute"}
        onClose={() => setDialog(null)}
        title={t("app.reportIssue")}
        description={t("app.issueBody")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={loading}
              disabled={!reason || !details}
              onClick={() => submit("dispute", { reason, details })}
            >
              {t("app.submitIssue")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t("app.disputeReason")} required>
            <Select value={reason} onChange={(event) => setReason(event.target.value)}>
              <option value="">{t("app.chooseIssue")}</option>
              <option value="Work duration or measurement">
                {t("app.issueWorkDuration")}
              </option>
              <option value="Final bill amount">{t("app.issueBillAmount")}</option>
              <option value="Payment not confirmed">
                {t("app.issuePaymentNotConfirmed")}
              </option>
              <option value="Work not completed as expected">
                {t("app.issueWorkIncomplete")}
              </option>
              <option value="Other">{t("app.issueOther")}</option>
            </Select>
          </Field>
          <Field label={t("app.disputeDetails")} required>
            <Textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder={t("app.issueDetailsPlaceholder")}
            />
          </Field>
          <Alert tone="info">
            The original booking, work sessions, final bill and payment records are preserved while this issue is reviewed.
          </Alert>
        </div>
        {error ? <Alert tone="danger" className="mt-3">{error}</Alert> : null}
      </Modal>
    </div>
  );
}

export function WorkSummary({ booking }: { booking: BookingDetail }) {
  const { t } = useI18n();
  const { minutes, breakMinutes, segments } = useWorkMinutes(booking);
  const measurement = booking.measurement;
  const billable = measurement?.billableMinutes ?? minutes;

  return (
    <div className="space-y-3">
      {booking.pricingType === "hourly" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-forest/6 px-3 py-2.5">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-stone">
                {t("app.activeBillable")}
              </p>
              <p className="mt-0.5 font-display text-lg text-forest">
                {minutesToHoursLabel(booking.status === "COMPLETED" || booking.status === "PAID" ? billable : minutes)}
              </p>
            </div>
            <div className="rounded-xl bg-sand/50 px-3 py-2.5">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-stone">
                {t("app.breakNotBilled")}
              </p>
              <p className="mt-0.5 font-display text-lg text-forest">
                {minutesToHoursLabel(breakMinutes)}
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            {segments.map((segment, index) => (
              <div
                key={`${segment.start}-${index}`}
                className="flex items-center justify-between rounded-lg border border-line/70 px-3 py-2 text-[0.7rem]"
              >
                <span className="text-stone">
                  {formatTime(segment.start)}
                  {segment.end ? ` → ${formatTime(segment.end)}` : ` → ${t("app.nowLabel")}`}
                </span>
                <span className="font-semibold text-forest">
                  {segment.end
                    ? minutesToHoursLabel(
                        Math.max(
                          0,
                          Math.round(
                            (new Date(segment.end).getTime() - new Date(segment.start).getTime()) / 60000,
                          ),
                        ),
                      )
                    : t("common.active")}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : booking.pricingType === "acre" ? (
        <div className="rounded-xl bg-forest/6 px-3.5 py-3">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-stone">
            {t(
              booking.status === "COMPLETED" || booking.status === "PAID"
                ? "app.completedArea"
                : "app.estimatedArea",
            )}
          </p>
          <p className="mt-0.5 font-display text-xl text-forest">
            {t("app.acresCount", {
              count: measurement?.completedAcres ?? booking.estimatedAcres ?? "—",
            })}
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-forest/6 px-3.5 py-3">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-stone">
            {t("app.completedTrips")}
          </p>
          <p className="mt-0.5 font-display text-xl text-forest">
            {t("app.tripsCount", {
              count: measurement?.completedTrips ?? booking.estimatedTrips ?? "—",
            })}
          </p>
        </div>
      )}
    </div>
  );
}

export function BookingHistory({ booking }: { booking: BookingDetail }) {
  const { t, statusLabel } = useI18n();
  return (
    <ol className="relative space-y-3 pl-4">
      <span className="absolute bottom-1 left-[0.3rem] top-1 w-px bg-line" />
      {booking.history.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-4 top-1.5 size-2 rounded-full border border-paper bg-moss" />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="text-xs font-semibold text-forest">{entry.reason}</p>
            <p className="text-[0.62rem] text-stone">{formatDateTime(entry.createdAt)}</p>
          </div>
          <p className="mt-0.5 text-[0.62rem] uppercase tracking-[0.1em] text-stone/60">
            {entry.changedByRole === "system" ? t("app.system") : entry.changedByRole}
            {entry.oldStatus
              ? ` · ${statusLabel(entry.oldStatus)} → ${statusLabel(entry.newStatus)}`
              : ` · ${statusLabel(entry.newStatus)}`}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function InlineNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-sand/40 px-3 py-2 text-[0.68rem] leading-relaxed text-stone">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
      {children}
    </div>
  );
}

export function PaymentMethodLabel({ method }: { method: PaymentMethod }) {
  return <>{PAYMENT_METHODS.find((item) => item.id === method)?.label ?? method}</>;
}

export function ReceiptIcon() {
  return <ReceiptText className="size-4" />;
}
