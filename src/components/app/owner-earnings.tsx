"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  IndianRupee,
  TrendingUp,
  Tractor,
} from "lucide-react";
import { Badge, Card, EmptyState, buttonStyles } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import { formatRupees } from "@/lib/pricing";
import type { OwnerEarningsSummary } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

export function OwnerEarningsCard({
  earnings,
  compact = false,
}: {
  earnings: OwnerEarningsSummary;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const maxTotal = Math.max(
    1,
    ...earnings.byTractor.map((tractor) => tractor.total),
  );
  const hasEarnings = earnings.byTractor.some(
    (tractor) => tractor.total > 0 || tractor.pending > 0,
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/70 px-4 py-4 sm:px-5">
        <div>
          <p className="eyebrow">{t("app.ownerTag")}</p>
          <h2 className="mt-1 font-display text-xl text-forest">
            {t("app.earningsTitle")}
          </h2>
          <p className="mt-1 max-w-xl text-[0.68rem] leading-relaxed text-stone">
            {t("app.earningsSub")}
          </p>
        </div>
        <Link
          href="/owner/payments"
          className={buttonStyles("outline", "sm", "shrink-0")}
        >
          {t("app.paymentDetailsLink")} <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 sm:p-5">
        <EarningStat
          label={t("app.totalEarned")}
          value={formatRupees(earnings.total)}
          icon={<IndianRupee className="size-3.5" />}
          tone="bg-forest/8 text-forest"
        />
        <EarningStat
          label={t("app.thisMonth")}
          value={formatRupees(earnings.thisMonth)}
          icon={<TrendingUp className="size-3.5" />}
          tone="bg-wheat/40 text-[#7a5a1d]"
        />
        <EarningStat
          label={t("app.pendingPayments")}
          value={formatRupees(earnings.pending)}
          icon={<Clock3 className="size-3.5" />}
          tone="bg-clay/10 text-clay-dark"
        />
        <EarningStat
          label={t("app.completedJobs")}
          value={String(earnings.completedJobs)}
          icon={<CheckCircle2 className="size-3.5" />}
          tone="bg-forest/8 text-forest"
        />
      </div>

      <div className="border-t border-line/70 px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-forest">
            {t("app.earningsByTractor")}
          </h3>
          <Badge tone="stone">
            {t("app.confirmedPayments")}: {earnings.confirmedPayments}
          </Badge>
        </div>

        {earnings.byTractor.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={<Tractor className="size-5" />}
              title={t("app.noTractorYet")}
              body={t("app.addTractorForEarnings")}
              action={
                <Link
                  href="/owner/tractor"
                  className={buttonStyles("primary", "sm")}
                >
                  {t("app.ownerTractorAdd")} <ArrowRight className="size-3.5" />
                </Link>
              }
            />
          </div>
        ) : !hasEarnings && !compact ? (
          <div className="mt-3">
            <EmptyState
              icon={<IndianRupee className="size-5" />}
              title={t("app.noEarningsYet")}
              body={t("app.noEarningsYetBody")}
            />
          </div>
        ) : (
          <div className={cn("mt-3 space-y-3", compact && "space-y-2.5")}>
            {earnings.byTractor.slice(0, compact ? 3 : undefined).map((tractor) => (
              <div
                key={tractor.tractorId}
                className="rounded-2xl border border-line/70 bg-cream/25 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-forest">
                      {tractor.brand} {tractor.model}
                    </p>
                    <p className="text-[0.62rem] text-stone">
                      {tractor.registrationNumber} ·{" "}
                      {t("app.jobsCount", { count: tractor.completedJobs })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg leading-none text-forest">
                      {formatRupees(tractor.total)}
                    </p>
                    <p className="mt-1 text-[0.58rem] text-stone">
                      {t("app.thisMonth")}: {formatRupees(tractor.thisMonth)}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-forest/10">
                  <div
                    className="h-full rounded-full bg-forest"
                    style={{
                      width: `${Math.max(
                        tractor.total > 0 ? 4 : 0,
                        Math.round((tractor.total / maxTotal) * 100),
                      )}%`,
                    }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[0.6rem] text-stone">
                  <span>
                    {t("app.pendingPayments")}: {formatRupees(tractor.pending)}
                  </span>
                  <span>
                    {tractor.lastPaidAt
                      ? t("app.lastPaid", {
                          date: formatDateTime(tractor.lastPaidAt),
                        })
                      : t("app.noPaymentYet")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!compact && earnings.recent.length > 0 ? (
        <div className="border-t border-line/70 px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-forest">
              {t("app.recentPayments")}
            </h3>
            <Link
              href="/owner/payments"
              className="text-[0.65rem] font-semibold text-forest hover:text-clay"
            >
              {t("common.viewAll")} →
            </Link>
          </div>
          <div className="mt-2 divide-y divide-line/60">
            {earnings.recent.slice(0, 5).map((payment) => (
              <div
                key={payment.paymentId}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      payment.paymentStatus === "confirmed"
                        ? "bg-forest/8 text-forest"
                        : "bg-wheat/30 text-[#7a5a1d]",
                    )}
                  >
                    {payment.paymentStatus === "confirmed" ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      <Clock3 className="size-3.5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[0.7rem] font-semibold text-forest">
                      {payment.farmerName} · {payment.tractorLabel}
                    </p>
                    <p className="text-[0.6rem] text-stone">
                      {payment.paymentStatus === "confirmed"
                        ? t("app.received")
                        : t("app.awaitingYourConfirmation")}{" "}
                      · {formatDateTime(payment.confirmedAt ?? payment.paidAt)}
                    </p>
                  </div>
                </div>
                <p className="font-display text-base text-forest">
                  {formatRupees(payment.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="border-t border-line/70 bg-cream/30 px-4 py-2.5 text-[0.6rem] leading-relaxed text-stone sm:px-5">
        {t("app.earningsOnlyConfirmed")}
      </p>
    </Card>
  );
}

function EarningStat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-line/60 bg-paper px-3 py-2.5">
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-lg",
          tone,
        )}
      >
        {icon}
      </span>
      <p className="mt-2 font-display text-lg leading-tight text-forest">
        {value}
      </p>
      <p className="mt-0.5 text-[0.58rem] font-medium uppercase tracking-[0.08em] text-stone">
        {label}
      </p>
    </div>
  );
}
