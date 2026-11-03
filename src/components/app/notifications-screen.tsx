"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import {
  Bell,
  BellRing,
  CalendarDays,
  Check,
  CheckCheck,
  HandCoins,
  Info,
  Tractor,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  buttonStyles,
} from "@/components/ui/primitives";
import { useToast } from "@/components/providers/app-providers";
import { useI18n } from "@/lib/i18n";
import type { Notification } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

const TYPE_META: Record<
  Notification["type"],
  { icon: typeof Bell; tone: string }
> = {
  booking: { icon: CalendarDays, tone: "bg-forest/8 text-forest" },
  payment: { icon: HandCoins, tone: "bg-wheat/40 text-[#7a5a1d]" },
  work: { icon: Tractor, tone: "bg-sky/10 text-sky" },
  system: { icon: Info, tone: "bg-sand/70 text-stone" },
};

export function NotificationsScreen() {
  const { t } = useI18n();
  const { push } = useToast();
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();
  const typeLabel = (type: Notification["type"]) =>
    type === "booking"
      ? t("app.typeBooking")
      : type === "payment"
        ? t("app.typePayment")
        : type === "work"
          ? t("app.typeWork")
          : t("app.typeUpdate");
  const { data, isLoading, mutate } = useSWR<{
    notifications: Notification[];
    unread: number;
  }>("/api/notifications", { refreshInterval: 30000 });
  const notifications = data?.notifications ?? [];
  const unread = data?.unread ?? 0;

  async function markRead(ids?: string[]) {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { ids } : {}),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? t("app.couldNotUpdateNotifications"));
      await mutate();
      await globalMutate(
        (key) => typeof key === "string" && key.startsWith("/api/notifications"),
      );
    } catch (error) {
      push(
        error instanceof Error
          ? error.message
          : t("app.couldNotUpdateNotifications"),
        "error",
      );
    }
  }

  async function openNotification(notification: Notification) {
    if (!notification.read) await markRead([notification.id]);
    if (notification.bookingId) router.push(`/bookings/${notification.bookingId}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="green" dot>{t("app.notificationsTitle")}</Badge>
            {unread > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-clay/10 px-2 py-1 text-[0.62rem] font-semibold text-clay-dark">
                <BellRing className="size-3" /> {t("app.unreadCount", { count: unread })}
              </span>
            ) : null}
          </div>
          <h1 className="mt-2 font-display text-3xl text-forest sm:text-[2.4rem]">
            {t("app.notificationsTitle")}
          </h1>
          <p className="mt-1 text-sm text-stone">{t("app.notificationsSub")}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => markRead()}
          disabled={unread === 0}
        >
          <CheckCheck className="size-4" /> {t("app.markAllRead")}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-24 w-full" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-5" />}
          title={t("app.noNotifications")}
          body={t("app.notificationsEmptyBody")}
          action={
            <Link href="/bookings" className={buttonStyles("outline", "sm")}>
              {t("app.viewBookings")}
            </Link>
          }
        />
      ) : (
        <Card className="divide-y divide-line/70 overflow-hidden">
          {notifications.map((notification) => {
            const meta = TYPE_META[notification.type] ?? TYPE_META.system;
            const Icon = meta.icon;
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-cream/40 sm:px-5",
                  !notification.read && "bg-forest/[0.035]",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    meta.tone,
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-stone/60">
                      {typeLabel(notification.type)}
                    </span>
                    {!notification.read ? (
                      <span className="size-1.5 rounded-full bg-clay" />
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold text-forest">
                    {notification.title}
                  </span>
                  <span className="mt-0.5 block text-[0.7rem] leading-relaxed text-stone">
                    {notification.body}
                  </span>
                  <span className="mt-1 block text-[0.6rem] text-stone/65">
                    {formatDateTime(notification.createdAt)}
                  </span>
                </span>
                {notification.bookingId ? (
                  <span className="mt-1 shrink-0 text-[0.62rem] font-semibold text-clay">
                    {t("app.open")} →
                  </span>
                ) : !notification.read ? (
                  <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border border-line text-stone">
                    <Check className="size-3" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </Card>
      )}

      <div className="flex flex-col items-start justify-between gap-3 rounded-[1.4rem] border border-forest/10 bg-[linear-gradient(120deg,#eaf0e4,#f3ecd9)] p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-forest text-wheat">
            <Wallet className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-forest">
              {t("app.paymentRemindersInfo")}
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
