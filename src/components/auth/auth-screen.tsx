"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LockKeyhole,
  LocateFixed,
  MapPin,
  ShieldCheck,
  Smartphone,
  Sprout,
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
import { cn, maskMobile, mobileEnding, reverseGeocode } from "@/lib/utils";
import { TractorOnboardingWizard } from "@/components/app/tractor-onboarding-wizard";

type Step = "mobile" | "otp" | "farmer_onboarding" | "tractor_onboarding";

export function AuthScreen({ initialRole }: { initialRole: Role }) {
  const router = useRouter();
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

  async function requestOtp(event?: SyntheticEvent) {
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
        hasTractor?: boolean;
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
        if (signedInRole === "owner" && !data.hasTractor) {
          router.push("/owner/tractor?onboarding=1");
          router.refresh();
        } else {
          router.push("/dashboard");
          router.refresh();
        }
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

  async function verifyOtp(event: SyntheticEvent) {
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
        role?: Role;
        hasTractor?: boolean;
        hasFarmerDetails?: boolean;
      };
      if (!response.ok) {
        throw new Error(
          data.code === "identity_mismatch"
            ? t("auth.mismatch")
            : data.error ?? t("auth.couldNotVerifyOtp"),
        );
      }

      const activeRole = data.role ?? role;

      // 1. Farmer Login & Registration:
      // If farmer already has details saved in storage -> directly go to dashboard.
      // If first-time farmer -> fill farmer registration details (Name, Address, Auto-detect GPS)
      if (activeRole === "farmer") {
        if (data.hasFarmerDetails) {
          push(t("auth.welcomeBack"), "success");
          router.push("/dashboard");
          router.refresh();
          return;
        }
        setAuthenticatedUser(data.user ?? null);
        setName(data.user?.name ?? "");
        setStep("farmer_onboarding");
        return;
      }

      // 2. Tractor Owner Login:
      // If a tractor owner has already registered their details (name, tractor details, etc.)
      // and these are present in the backend, directly redirect to owner dashboard without re-registering.
      if (activeRole === "owner") {
        if (data.hasTractor) {
          push(t("auth.welcomeBack"), "success");
          router.push("/dashboard");
          router.refresh();
          return;
        }

        // 1. Tractor Owner Registration:
        // New tractor owner or owner without tractor registered yet provides tractor details.
        setAuthenticatedUser(data.user ?? null);
        setStep("tractor_onboarding");
        return;
      }

      // Attach new session cookies and navigate to dashboard
      router.push("/dashboard");
      router.refresh();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : t("auth.couldNotVerifyOtp"));
      setLoading(false);
    }
  }

  const roleCards: { id: Role; title: string; body: string; icon: typeof UserRound }[] = [
    { id: "farmer", title: t("auth.farmer"), body: t("auth.farmerBody"), icon: UserRound },
    { id: "owner", title: t("auth.owner"), body: t("auth.ownerBody"), icon: Tractor },
  ];

  if (step === "farmer_onboarding") {
    return (
      <div className="min-h-dvh bg-cream px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl">
          <div className="mb-6 flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
            </div>
          </div>
          <FarmerOnboardingView
            user={authenticatedUser}
            initialName={name}
            onCompleted={() => {
              router.push("/dashboard");
              router.refresh();
            }}
          />
        </div>
      </div>
    );
  }

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
              router.push("/dashboard");
              router.refresh();
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

              {role === "owner" && !isExisting ? (
                <Field label={t("auth.nameLabel")} hint={t("auth.nameHint")} htmlFor="name" required>
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t("auth.namePlaceholder")}
                    autoComplete="name"
                    required
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

              {role === "owner" && !isExisting && !name ? (
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

function FarmerOnboardingView({
  user,
  initialName,
  onCompleted,
}: {
  user: SessionUser | null;
  initialName: string;
  onCompleted: () => void;
}) {
  const { t } = useI18n();
  const { push } = useToast();
  const [name, setName] = useState(initialName || user?.name || "");
  const [village, setVillage] = useState(user?.farmerProfile?.village ?? "");
  const [address, setAddress] = useState(user?.farmerProfile?.address ?? "");
  const [pincode, setPincode] = useState(user?.farmerProfile?.pincode ?? "");
  const [district, setDistrict] = useState(user?.farmerProfile?.district ?? "");
  const [state, setState] = useState(user?.farmerProfile?.state ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    user?.farmerProfile?.lat && user?.farmerProfile?.lng
      ? { lat: user.farmerProfile.lat, lng: user.farmerProfile.lng }
      : null,
  );
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedSummary, setDetectedSummary] = useState<string | null>(null);

  async function handleAutoDetect() {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    setError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          setCoords({ lat, lng });
          const geo = await reverseGeocode(lat, lng);
          if (geo.village) setVillage(geo.village);
          if (geo.pincode) setPincode(geo.pincode);
          if (geo.district) setDistrict(geo.district);
          if (geo.state) setState(geo.state);
          if (geo.address) setAddress(geo.address);
          setDetectedSummary(
            [geo.village, geo.district, geo.pincode].filter(Boolean).join(", ") ||
              `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          );
          push(t("app.profileUpdated") || "Location auto-detected!", "success");
        } catch {
          setError("Failed to fetch address from location. Please enter your village manually.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setError("Location permission denied or unavailable. Please type your village.");
      },
      { timeout: 12000, enableHighAccuracy: true },
    );
  }

  async function handleSave(e: SyntheticEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!village.trim()) {
      setError("Please enter your village or town.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          village: village.trim(),
          address: address.trim() || village.trim(),
          pincode: pincode.trim(),
          district: district.trim(),
          state: state.trim(),
          lat: coords?.lat,
          lng: coords?.lng,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to save profile");
      }
      push(t("app.profileSaved"), "success");
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save farmer registration.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-line bg-paper p-6 shadow-soft sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-forest/8 text-forest">
          <Sprout className="size-6" />
        </span>
        <div>
          <Badge tone="green" dot>
            Farmer Registration
          </Badge>
          <h2 className="mt-1 font-display text-2xl text-forest">Register Your Profile</h2>
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-stone">
        Please fill in your name and location details to connect with nearby tractor owners and start booking.
      </p>

      {error ? (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      ) : null}

      <form onSubmit={handleSave} className="mt-6 space-y-4">
        <Field label="Full Name" htmlFor="farmer-name" required>
          <Input
            id="farmer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ramesh Kumar"
            autoComplete="name"
            required
          />
        </Field>

        <div className="rounded-2xl border border-line/70 bg-cream/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-forest">Auto-Detect Farm Location</p>
              <p className="text-[0.65rem] text-stone">Use your current GPS coordinates to fill village and PIN</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={locating}
              onClick={handleAutoDetect}
              className="gap-1.5 shrink-0"
            >
              <LocateFixed className="size-3.5" />
              {locating ? "Locating..." : "Auto-Detect"}
            </Button>
          </div>
          {detectedSummary ? (
            <div className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-forest/8 px-3 py-1.5 text-xs font-medium text-forest">
              <MapPin className="size-3.5 shrink-0" />
              <span>Detected: {detectedSummary}</span>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Village / Town" htmlFor="farmer-village" required>
            <Input
              id="farmer-village"
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              placeholder="e.g. Doddabele"
              required
            />
          </Field>
          <Field label="PIN Code" htmlFor="farmer-pincode">
            <Input
              id="farmer-pincode"
              inputMode="numeric"
              maxLength={6}
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="e.g. 560060"
            />
          </Field>
        </div>

        <Field label="Farm Address / Landmark" htmlFor="farmer-address">
          <Input
            id="farmer-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Near Old Temple, Post Doddabele"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="District" htmlFor="farmer-district">
            <Input
              id="farmer-district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="e.g. Bangalore Rural"
            />
          </Field>
          <Field label="State" htmlFor="farmer-state">
            <Input
              id="farmer-state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="e.g. Karnataka"
            />
          </Field>
        </div>

        <Button type="submit" size="lg" className="w-full mt-2" loading={saving}>
          Save & Go to Dashboard <ArrowRight className="size-4" />
        </Button>
      </form>
    </div>
  );
}
