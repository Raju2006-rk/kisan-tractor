"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Bell,
  BookOpen,
  ChevronRight,
  CircleHelp,
  Home,
  LogOut,
  MapPin,
  Power,
  Tractor,
  UserRound,
  Volume2,
  VolumeX,
  Wallet,
  Compass,
  CalendarDays,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Avatar } from "@/components/ui/primitives";
import { useToast } from "@/components/providers/app-providers";
import { useI18n } from "@/lib/i18n";
import { playNotificationSound } from "@/lib/notification-sound";
import type { Notification, SessionUser } from "@/lib/types";
import { cn, maskMobile } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof Home; match?: string };

export function AppShell({
  user,
  dateLabel,
  children,
}: {
  user: SessionUser;
  dateLabel: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { push } = useToast();
  const [online, setOnline] = useState(user.ownerProfile?.online ?? false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const seenNotificationIds = useRef<Set<string> | null>(null);
  const { data } = useSWR<{ notifications: Notification[]; unread: number }>(
    "/api/notifications",
    { refreshInterval: 15000 },
  );

  const isOwner = user.role === "owner";

  useEffect(() => {
    const stored = window.localStorage.getItem("kt_sound");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "off") setSoundOn(false);
  }, []);

  useEffect(() => {
    const rows = data?.notifications;
    if (!rows) return;
    if (seenNotificationIds.current === null) {
      // Do not chime for notifications that were already waiting on page load.
      seenNotificationIds.current = new Set(rows.map((item) => item.id));
      return;
    }
    const seen = seenNotificationIds.current;
    const fresh = rows.filter((item) => !item.read && !seen.has(item.id));
    rows.forEach((item) => seen.add(item.id));
    if (fresh.length > 0 && soundOn) {
      playNotificationSound(user.role);
    }
  }, [data?.notifications, soundOn, user.role]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    window.localStorage.setItem("kt_sound", next ? "on" : "off");
    if (next) playNotificationSound(user.role);
    push(
      next
        ? "Notification sounds on."
        : "Notification sounds muted. New updates still appear in your notifications.",
      "info",
    );
  }

  const primaryNav: NavItem[] = isOwner
    ? [
        { href: "/dashboard", label: t("nav.home"), icon: Home },
        { href: "/bookings", label: t("nav.bookings"), icon: CalendarDays },
        { href: "/owner/tractor", label: t("nav.myTractor"), icon: Tractor },
        { href: "/owner/payments", label: t("nav.payments"), icon: Wallet },
        { href: "/profile", label: t("nav.profile"), icon: UserRound },
      ]
    : [
        { href: "/dashboard", label: t("nav.home"), icon: Home },
        { href: "/explore", label: t("nav.explore"), icon: Compass },
        { href: "/bookings", label: t("nav.bookings"), icon: CalendarDays },
        { href: "/help", label: t("nav.help"), icon: CircleHelp },
        { href: "/profile", label: t("nav.profile"), icon: UserRound },
      ];

  const mobileNav: NavItem[] = isOwner
    ? [
        { href: "/dashboard", label: t("nav.home"), icon: Home },
        { href: "/bookings", label: t("nav.bookings"), icon: CalendarDays },
        { href: "/owner/tractor", label: "Tractor", icon: Tractor },
        { href: "/profile", label: t("nav.profile"), icon: UserRound },
      ]
    : [
        { href: "/dashboard", label: t("nav.home"), icon: Home },
        { href: "/explore", label: t("nav.explore"), icon: Compass },
        { href: "/bookings", label: t("nav.bookings"), icon: CalendarDays },
        { href: "/help", label: t("nav.help"), icon: CircleHelp },
        { href: "/profile", label: t("nav.profile"), icon: UserRound },
      ];

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/bookings") return pathname.startsWith("/bookings");
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function toggleOnline() {
    const next = !online;
    setStatusLoading(true);
    try {
      const response = await fetch("/api/owner/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ online: next }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not update availability.");
      setOnline(next);
      push(
        next
          ? "You’re online for new booking requests."
          : "You’re offline. Accepted and active work is unaffected.",
        next ? "success" : "info",
      );
      router.refresh();
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not update availability.", "error");
    } finally {
      setStatusLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const unread = data?.unread ?? 0;

  return (
    <div className="min-h-dvh bg-cream">
      <aside className="sidebar-gradient fixed inset-y-0 left-0 z-40 hidden w-[17.5rem] flex-col px-4 py-5 text-cream lg:flex">
        <div className="px-2">
          <Logo variant="light" href="/dashboard" showTag />
        </div>

        <div className="mt-7 rounded-2xl border border-cream/10 bg-cream/5 p-3.5">
          <div className="flex items-center gap-2.5">
            <Avatar name={user.name} className="!bg-wheat !text-forest" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-cream">{user.name}</p>
              <p className="truncate text-[0.65rem] text-cream/50">{maskMobile(user.mobile)}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-cream/5 px-2.5 py-2">
            <span className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-cream/50">
              {isOwner ? "Tractor owner" : "Farmer"}
            </span>
            <span className="inline-flex items-center gap-1 text-[0.62rem] font-semibold text-wheat">
              {isOwner ? (online ? "Online" : "Offline") : "Nashik"}
            </span>
          </div>
        </div>

        {isOwner ? (
          <button
            type="button"
            role="switch"
            aria-checked={online}
            aria-label="Online for new booking requests"
            onClick={toggleOnline}
            disabled={statusLoading}
            className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-cream/10 bg-cream/5 px-3.5 py-3 text-left transition hover:bg-cream/8 disabled:opacity-60"
          >
            <span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-cream">
                <Power className="size-3.5 text-wheat" />
                {online ? t("app.ownerOnline") : "Offline for new requests"}
              </span>
              <span className="mt-0.5 block text-[0.62rem] leading-relaxed text-cream/45">
                {t("app.ownerOfflineHint")}
              </span>
            </span>
            <span
              className={cn(
                "relative h-5 w-9 shrink-0 rounded-full transition",
                online ? "bg-wheat" : "bg-cream/20",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-4 rounded-full bg-forest transition-all",
                  online ? "left-[1.1rem]" : "left-0.5",
                )}
              />
            </span>
          </button>
        ) : null}

        <nav className="mt-5 flex-1 space-y-1 overflow-y-auto">
          {primaryNav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.82rem] font-semibold transition",
                  active
                    ? "bg-cream text-forest shadow-[0_8px_20px_-14px_rgba(0,0,0,0.6)]"
                    : "text-cream/65 hover:bg-cream/8 hover:text-cream",
                )}
              >
                <item.icon className={cn("size-4", active ? "text-forest" : "text-cream/45")} />
                {item.label}
                {active ? <ChevronRight className="ml-auto size-3.5 opacity-50" /> : null}
              </Link>
            );
          })}

          <div className="pt-3">
            <p className="px-3 pb-1.5 text-[0.58rem] font-bold uppercase tracking-[0.18em] text-cream/30">
              More
            </p>
            <Link
              href="/notifications"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.82rem] font-semibold transition",
                pathname === "/notifications"
                  ? "bg-cream text-forest"
                  : "text-cream/65 hover:bg-cream/8 hover:text-cream",
              )}
            >
              <Bell className="size-4 text-cream/45" />
              {t("nav.notifications")}
              {unread > 0 ? (
                <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-clay text-[0.6rem] font-bold text-paper">
                  {unread}
                </span>
              ) : null}
            </Link>
            <Link
              href="/help"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.82rem] font-semibold text-cream/65 transition hover:bg-cream/8 hover:text-cream"
            >
              <BookOpen className="size-4 text-cream/45" />
              {t("nav.help")}
            </Link>
          </div>
        </nav>

        <div className="space-y-2 border-t border-cream/10 pt-3">
          <div className="flex items-center justify-between px-1">
            <LanguageSwitcher variant="dark" />
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-[0.62rem] font-semibold text-cream/50 hover:text-cream"
            >
              <MapPin className="size-3" /> Public site
            </Link>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[0.7rem] font-semibold text-cream/55 transition hover:text-cream"
          >
            <LogOut className="size-3.5" /> {t("common.logout")}
          </button>
        </div>
      </aside>

      <div className="lg:pl-[17.5rem]">
        <header className="sticky top-0 z-30 border-b border-line/70 bg-cream/88 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <Logo href="/dashboard" />
            </div>
            <div className="hidden flex-col lg:flex">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-stone/70">
                {isOwner ? "Tractor owner workspace" : "Farmer workspace"}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-forest">{dateLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:block">
                <LanguageSwitcher />
              </div>
              <button
                type="button"
                onClick={toggleSound}
                aria-label={soundOn ? "Mute notification sounds" : "Turn on notification sounds"}
                title={soundOn ? "Notification sounds on" : "Notification sounds muted"}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border transition",
                  soundOn
                    ? "border-forest/20 bg-forest/8 text-forest hover:border-forest/35"
                    : "border-line bg-paper text-stone/70 hover:border-forest/25 hover:text-forest",
                )}
              >
                {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              </button>
              <Link
                href="/notifications"
                aria-label="Notifications"
                className="relative flex size-9 items-center justify-center rounded-full border border-line bg-paper text-forest transition hover:border-forest/30"
              >
                <Bell className="size-4" />
                {unread > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex size-4.5 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[0.55rem] font-bold text-paper">
                    {unread}
                  </span>
                ) : null}
              </Link>
              <Link
                href="/profile"
                className="flex size-9 items-center justify-center rounded-full bg-forest text-xs font-bold text-cream lg:hidden"
                aria-label="Profile"
              >
                {user.name
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")}
              </Link>
              {isOwner ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={online}
                  aria-label="Online for new booking requests"
                  onClick={toggleOnline}
                  disabled={statusLoading}
                  title={online ? "Online for new requests" : "Offline for new requests"}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[0.65rem] font-semibold transition disabled:opacity-60",
                    online
                      ? "border-forest/20 bg-forest/8 text-forest"
                      : "border-line bg-paper text-stone",
                  )}
                >
                  <span>{online ? "Online" : "Offline"}</span>
                  <span
                    className={cn(
                      "relative h-5 w-9 rounded-full transition",
                      online ? "bg-forest" : "bg-stone/25",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 size-4 rounded-full bg-paper shadow transition-all",
                        online ? "left-[1.1rem]" : "left-0.5",
                      )}
                    />
                  </span>
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <main className="px-4 pb-28 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pb-12">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
          {mobileNav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.6rem] font-semibold transition",
                  active ? "text-forest" : "text-stone/70",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-10 items-center justify-center rounded-xl transition",
                    active ? "bg-forest/10" : "",
                  )}
                >
                  <item.icon className="size-4" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
