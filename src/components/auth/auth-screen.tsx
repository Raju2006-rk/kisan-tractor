"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  Tractor,
  UserRound,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Photo } from "@/components/ui/photo";
import { Alert, Badge, Button, Input, Field } from "@/components/ui/primitives";
import { useToast } from "@/components/providers/app-providers";
import { PHOTOS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import type { Role } from "@/lib/types";
import { cn, maskMobile, mobileEnding } from "@/lib/utils";

type Step = "mobile" | "otp";

export function AuthScreen({ initialRole }: { initialRole: Role }) {
  const router = useRouter();
  const { t, language } = useI18n();
  const { push } = useToast();
  const [role, setRole] = useState<Role>(initialRole);
  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [isExisting, setIsExisting] = useState(false);
  const [existingName, setExistingName] = useState<string | null>(null);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(id);
  }, [seconds]);

  useEffect(() => {
    if (step === "otp") {
      window.setTimeout(() => otpRef.current?.focus(), 150);
    }
  }, [step]);

  async function requestOtp(event?: React.FormEvent) {
    event?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, role, language }),
      });
      const data = (await response.json()) as {
        error?: string;
        demoOtp?: string;
        isExisting?: boolean;
        name?: string | null;
        role?: Role | null;
      };
      if (!response.ok) throw new Error(data.error ?? "Could not send the OTP.");
      setDemoOtp(data.demoOtp ?? null);
      setIsExisting(Boolean(data.isExisting));
      setExistingName(data.name ?? null);
      if (data.role) setRole(data.role);
      setStep("otp");
      setSeconds(60);
      setOtp("");
      push(`Sign-in OTP sent to your mobile ending ${mobileEnding(mobile)}.`, "info");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not send the OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, otp, name, role, language }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not verify this OTP.");
      router.push("/dashboard");
      router.refresh();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Could not verify this OTP.");
      setLoading(false);
    }
  }

  async function demoLogin(demoRole: Role) {
    setDemoLoading(demoRole);
    setError(null);
    try {
      const response = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: demoRole }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Demo login failed.");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (demoError) {
      setError(demoError instanceof Error ? demoError.message : "Demo login failed.");
      setDemoLoading(null);
    }
  }

  const roleCards: { id: Role; title: string; body: string; icon: typeof UserRound }[] = [
    { id: "farmer", title: t("auth.farmer"), body: t("auth.farmerBody"), icon: UserRound },
    { id: "owner", title: t("auth.owner"), body: t("auth.ownerBody"), icon: Tractor },
  ];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.02fr_0.98fr]">
      <div className="flex min-h-dvh flex-col bg-cream px-5 py-6 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-stone transition hover:text-forest sm:inline-flex"
            >
              <ArrowLeft className="size-3.5" /> {t("auth.backHome")}
            </Link>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <div className="rise-in">
            <span className="eyebrow">{t("auth.eyebrow")}</span>
            <h1 className="mt-4 text-balance font-display text-3xl leading-tight text-forest sm:text-[2.4rem]">
              {step === "mobile" ? t("auth.title") : t("auth.otpTitle")}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-stone">
              {step === "mobile"
                ? t("auth.subtitle")
                : t("auth.otpSent", { ending: mobileEnding(mobile) })}
            </p>
          </div>

          {error ? (
            <Alert tone="danger" className="mt-5">
              {error}
            </Alert>
          ) : null}

          {step === "mobile" ? (
            <form onSubmit={requestOtp} className="mt-6 space-y-5">
              <div>
                <p className="mb-2 text-[0.8rem] font-semibold text-forest">{t("auth.roleTitle")}</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {roleCards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setRole(card.id)}
                      className={cn(
                        "relative rounded-2xl border p-3.5 text-left transition",
                        role === card.id
                          ? "border-forest bg-forest text-cream shadow-[0_12px_30px_-20px_rgba(22,59,42,0.9)]"
                          : "border-line bg-paper text-forest hover:border-forest/30",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-9 items-center justify-center rounded-xl",
                          role === card.id ? "bg-cream/12 text-wheat" : "bg-forest/8 text-forest",
                        )}
                      >
                        <card.icon className="size-4" />
                      </span>
                      <span className="mt-3 block text-[0.8rem] font-bold">{card.title}</span>
                      <span
                        className={cn(
                          "mt-0.5 block text-[0.68rem] leading-relaxed",
                          role === card.id ? "text-cream/65" : "text-stone",
                        )}
                      >
                        {card.body}
                      </span>
                      {role === card.id ? (
                        <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-wheat text-forest">
                          <Check className="size-3" />
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>

              <Field label={t("auth.mobileLabel")} hint={t("auth.mobileHint")} htmlFor="mobile" required>
                <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3.5 transition focus-within:border-forest/50 focus-within:ring-4 focus-within:ring-forest/8">
                  <span className="text-sm font-semibold text-stone">+91</span>
                  <input
                    id="mobile"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={10}
                    value={mobile}
                    onChange={(event) => setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="98765 43210"
                    className="h-11 flex-1 bg-transparent text-sm tracking-[0.08em] text-ink placeholder:tracking-normal placeholder:text-stone/50 focus:outline-none"
                  />
                  <Smartphone className="size-4 text-stone/50" />
                </div>
              </Field>

              {!isExisting ? (
                <Field label={t("auth.nameLabel")} hint={t("auth.nameHint")} htmlFor="name">
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={role === "owner" ? "Ramesh Shinde" : "Amit Patil"}
                    autoComplete="name"
                  />
                </Field>
              ) : null}

              <Button type="submit" size="lg" className="w-full" loading={loading} disabled={mobile.length !== 10}>
                {t("auth.sendOtp")} <ArrowRight className="size-4" />
              </Button>

              <p className="flex items-start gap-2 text-[0.68rem] leading-relaxed text-stone">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-moss" />
                {t("auth.safety")}
              </p>
              <p className="text-center text-[0.65rem] text-stone/70">{t("auth.terms")}</p>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="mt-6 space-y-5">
              <div className="flex items-center justify-between rounded-2xl border border-line bg-paper px-4 py-3">
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-stone">
                    {role === "owner" ? t("auth.owner") : t("auth.farmer")}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-forest">
                    {isExisting && existingName ? existingName : name || maskMobile(mobile)}
                  </p>
                  <p className="text-xs text-stone">{maskMobile(mobile)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep("mobile");
                    setError(null);
                  }}
                  className="text-xs font-semibold text-clay hover:underline"
                >
                  {t("auth.changeMobile")}
                </button>
              </div>

              {!isExisting ? (
                <Field label={t("auth.nameLabel")} hint={t("auth.nameHint")} htmlFor="name-otp">
                  <Input
                    id="name-otp"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={role === "owner" ? "Ramesh Shinde" : "Amit Patil"}
                    autoComplete="name"
                  />
                </Field>
              ) : null}

              <Field label={t("auth.otpTitle")} htmlFor="otp" required>
                <Input
                  id="otp"
                  ref={otpRef}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="• • • • • •"
                  className="h-13 text-center text-xl tracking-[0.5em]"
                />
              </Field>

              {demoOtp ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-wheat/70 bg-wheat/20 px-4 py-3">
                  <div>
                    <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#7a5a1d]">
                      {t("auth.otpDemo")}
                    </p>
                    <p className="font-display text-xl tracking-[0.2em] text-forest">{demoOtp}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setOtp(demoOtp)}>
                    {t("auth.otpAutofill")}
                  </Button>
                </div>
              ) : null}

              <Button type="submit" size="lg" className="w-full" loading={loading} disabled={otp.length !== 6}>
                {t("auth.verify")} <ArrowRight className="size-4" />
              </Button>

              <div className="flex items-center justify-between text-xs text-stone">
                <span>
                  {seconds > 0 ? (
                    <>Resend in 00:{String(seconds).padStart(2, "0")}</>
                  ) : (
                    "Didn’t receive the OTP?"
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => requestOtp()}
                  disabled={seconds > 0 || loading}
                  className="font-semibold text-forest disabled:text-stone/50"
                >
                  {t("auth.resend")}
                </button>
              </div>

              <p className="flex items-start gap-2 rounded-2xl bg-forest/5 px-3.5 py-3 text-[0.68rem] leading-relaxed text-forest/75">
                <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
                {t("auth.safety")}
              </p>
            </form>
          )}

          <div className="mt-7 rounded-2xl border border-dashed border-line bg-paper/60 p-4">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-stone">
              {t("auth.demoTitle")}
            </p>
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => demoLogin("farmer")}
                disabled={demoLoading !== null}
                className="flex items-center justify-center gap-2 rounded-xl border border-forest/15 bg-cream px-3 py-2.5 text-[0.7rem] font-semibold text-forest transition hover:border-forest/35 disabled:opacity-60"
              >
                {demoLoading === "farmer" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <UserRound className="size-3.5" />
                )}
                {t("auth.demoFarmer")}
              </button>
              <button
                type="button"
                onClick={() => demoLogin("owner")}
                disabled={demoLoading !== null}
                className="flex items-center justify-center gap-2 rounded-xl border border-forest/15 bg-cream px-3 py-2.5 text-[0.7rem] font-semibold text-forest transition hover:border-forest/35 disabled:opacity-60"
              >
                {demoLoading === "owner" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Tractor className="size-3.5" />
                )}
                {t("auth.demoOwner")}
              </button>
            </div>
            <p className="mt-2 text-[0.62rem] text-stone/70">{t("auth.demoNote")}</p>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 border-t border-line/70 py-4 text-[0.62rem] text-stone">
          <span>© 2026 KisanTractor</span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3" /> Direct payments only
          </span>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-forest lg:block">
        <Photo
          src={PHOTOS.heroTractor}
          alt="Tractor working in a field"
          className="absolute inset-0 h-full w-full"
          sizes="50vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#102b1e] via-[#102b1e]/55 to-[#102b1e]/20" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <div className="flex justify-end">
            <Badge tone="green" className="!border-cream/20 !bg-cream/10 !text-cream">
              Rooted in local trust
            </Badge>
          </div>
          <div>
            <p className="max-w-md font-display text-4xl leading-[1.05] text-cream">
              “The farmer pays me directly. No middleman, no waiting for a payout.”
            </p>
            <div className="mt-6 flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-wheat font-display text-sm font-semibold text-forest">
                RS
              </span>
              <div>
                <p className="text-sm font-semibold text-cream">Ramesh Shinde</p>
                <p className="text-xs text-cream/55">Tractor owner · Niphad, Nashik</p>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                { value: "₹0", label: "Commission" },
                { value: "Direct", label: "Farmer → owner" },
                { value: "3", label: "Languages" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-cream/12 bg-cream/5 px-3 py-3 backdrop-blur">
                  <p className="font-display text-xl text-cream">{stat.value}</p>
                  <p className="mt-0.5 text-[0.6rem] uppercase tracking-[0.12em] text-cream/50">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
