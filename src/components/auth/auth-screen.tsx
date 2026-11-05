"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
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
import type { Role, SessionUser } from "@/lib/types";
import { cn, maskMobile, mobileEnding } from "@/lib/utils";
import { TractorOnboardingWizard } from "@/components/app/tractor-onboarding-wizard";

type Step = "mobile" | "otp" | "tractor_onboarding";

export function AuthScreen({ initialRole }: { initialRole: Role }) {
  const { t, language } = useI18n();
  const { push } = useToast();
  const [role, setRole] = useState<Role>(initialRole);
  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [authenticatedUser, setAuthenticatedUser] = useState<SessionUser | null>(null);
  const [isExisting, setIsExisting] = useState(false);
  const [existingName, setExistingName] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
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
        body: JSON.stringify({ mobile, name, role, language }),
      });
      const data = (await response.json()) as {
        error?: string;
        code?: string;
        signedIn?: boolean;
        devOtp?: string;
        isExisting?: boolean;
        name?: string | null;
        role?: Role | null;
      };
      if (!response.ok) {
        throw new Error(
          data.code === "identity_mismatch"
            ? t("auth.mismatch")
            : data.error ?? t("auth.couldNotSendOtp"),
        );
      }
      if (data.signedIn) {
        push(t("auth.welcomeBack"), "success");
        const signedInRole = data.role ?? role;
        // Force full document navigation so new session cookies are attached immediately
        window.location.href =
          signedInRole === "owner" ? "/owner/tractor?onboarding=1" : "/dashboard";
        return;
      }
      setDevOtp(data.devOtp ?? null);
      setIsExisting(Boolean(data.isExisting));
      setExistingName(data.name ?? null);
      if (data.role) setRole(data.role);
      setStep("otp");
      setSeconds(60);
      setOtp("");
      push(t("auth.otpSentToast", { ending: mobileEnding(mobile) }), "info");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("auth.couldNotSendOtp"));
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
      const data = (await response.json()) as {
        error?: string;
        code?: string;
        user?: SessionUser;
      };
      if (!response.ok) {
        throw new Error(
          data.code === "identity_mismatch"
            ? t("auth.mismatch")
            : data.error ?? t("auth.couldNotVerifyOtp"),
        );
      }
      if (role === "owner") {
        setAuthenticatedUser(data.user ?? null);
        setStep("tractor_onboarding");
        return;
      }
      // Force full document navigation so new session cookies are attached immediately
      window.location.href = "/dashboard";
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : t("auth.couldNotVerifyOtp"));
      setLoading(false);
    }
  }

  const roleCards: { id: Role; title: string; body: string; icon: typeof UserRound }[] = [
    { id: "farmer", title: t("auth.farmer"), body: t("auth.farmerBody"), icon: UserRound },
    { id: "owner", title: t("auth.owner"), body: t("auth.ownerBody"), icon: Tractor },
  ];

  if (step === "tractor_onboarding") {
    return (
      <div className="min-h-dvh bg-cream px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
            </div>
          </div>
          <TractorOnboardingWizard
            user={authenticatedUser}
            onCompleted={() => {
              window.location.href = "/dashboard";
            }}
          />
        </div>
      </div>
    );
  }

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
                    placeholder={t("auth.namePlaceholder")}
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
                    setIsExisting(false);
                    setExistingName(null);
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
                    placeholder={t("auth.namePlaceholder")}
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

              {devOtp ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-wheat/70 bg-wheat/20 px-4 py-3">
                  <div>
                    <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#7a5a1d]">
                      {t("auth.otpDev")}
                    </p>
                    <p className="font-display text-xl tracking-[0.2em] text-forest">{devOtp}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setOtp(devOtp)}>
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
                    <>
                      {t("auth.resendIn", {
                        seconds: String(seconds).padStart(2, "0"),
                      })}
                    </>
                  ) : (
                    t("auth.noOtp")
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => requestOtp()}
                  disabled={seconds > 0 || loading}
                  className="font-semibold text-forest disabled:text-stone/50"
                >
                  {t("auth.resendNow")}
                </button>
              </div>

              <p className="flex items-start gap-2 rounded-2xl bg-forest/5 px-3.5 py-3 text-[0.68rem] leading-relaxed text-forest/75">
                <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
                {t("auth.safety")}
              </p>
            </form>
          )}
        </div>

        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 border-t border-line/70 py-4 text-[0.62rem] text-stone">
          <span>© 2026 KisanTractor</span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3" /> {t("auth.directPaymentsOnly")}
          </span>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-forest lg:block">
        <Photo
          src={PHOTOS.heroTractor}
          alt={t("auth.heroAlt")}
          className="absolute inset-0 h-full w-full"
          sizes="50vw"
          priority
        />
        <div className="absolute inset-0 bg-linear-to-t from-[#102b1e] via-[#102b1e]/55 to-[#102b1e]/20" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <div className="flex justify-end">
            <Badge tone="green" className="border-cream/20! bg-cream/10! text-cream!">
              {t("auth.rootedTrust")}
            </Badge>
          </div>
          <div>
            <p className="max-w-md font-display text-4xl leading-[1.05] text-cream">
              {t("auth.testimonial")}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-wheat font-display text-sm font-semibold text-forest">
                <Tractor className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-cream">
                  {t("auth.testimonialBy")}
                </p>
                <p className="text-xs text-cream/55">{t("auth.testimonialPlace")}</p>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                { value: "₹0", label: t("auth.statCommission") },
                { value: t("auth.statDirect"), label: t("landing.payment.direct") },
                { value: "22", label: t("auth.statLanguages") },
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
