"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  FileCheck,
  Globe2,
  IdCard,
  ImagePlus,
  LocateFixed,
  LogOut,
  MapPin,
  ShieldCheck,
  Sprout,
  Tractor,
  Trash,
  Upload,
  UserRound,
  Wallet,
} from "lucide-react";
import { Photo } from "@/components/ui/photo";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
} from "@/components/ui/primitives";
import { useToast } from "@/components/providers/app-providers";
import { LANGUAGES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import type { Language, SessionUser } from "@/lib/types";
import { cn, formatDate, maskMobile, reverseGeocode } from "@/lib/utils";

export function ProfileScreen({ user }: { user: SessionUser }) {
  const { t, language, setLanguage, roleLabel } = useI18n();
  const { push } = useToast();
  const router = useRouter();
  const profile = user.farmerProfile ?? user.ownerProfile;
  const isOwner = user.role === "owner";
  const currentVillage = profile?.village ?? "";
  const [name, setName] = useState(user.name);
  const [village, setVillage] = useState(currentVillage);
  const [address, setAddress] = useState(profile?.address ?? "");
  const [pincode, setPincode] = useState(profile?.pincode ?? "");
  const [district, setDistrict] = useState(profile?.district ?? "");
  const [stateName, setStateName] = useState(profile?.state ?? "");
  const [serviceRadiusKm, setServiceRadiusKm] = useState(
    String(user.ownerProfile?.serviceRadiusKm ?? 15),
  );
  const [coords, setCoords] = useState(() => ({
    lat: profile?.lat ?? 0,
    lng: profile?.lng ?? 0,
  }));
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [dlPhoto, setDlPhoto] = useState(profile?.documents?.dlPhoto ?? "");
  const [rcNumber, setRcNumber] = useState(profile?.documents?.rcNumber ?? "");
  const [rcPhoto, setRcPhoto] = useState(profile?.documents?.rcPhoto ?? "");
  const [uploadingDoc, setUploadingDoc] = useState<"dl" | "rc" | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const dlInputRef = useRef<HTMLInputElement>(null);
  const rcInputRef = useRef<HTMLInputElement>(null);

  const rcNumberValid = /^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4}$/i.test(
    rcNumber.trim(),
  );
  const dlVerified = Boolean(dlPhoto);
  const rcVerified = rcNumberValid || Boolean(rcPhoto);
  const documentsVerified = dlVerified || rcVerified;

  function useMyLocation() {
    setLocationError(null);
    setLocationNote(null);
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setLocationError(t("app.locationNeedsHttps"));
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError(t("app.locationBrowserUnsupported"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Math.round(position.coords.latitude * 10000) / 10000;
        const lng = Math.round(position.coords.longitude * 10000) / 10000;
        setCoords({ lat, lng });

        try {
          const geo = await reverseGeocode(lat, lng);
          if (geo.village) setVillage(geo.village);
          if (geo.address) setAddress(geo.address);
          if (geo.pincode) setPincode(geo.pincode);
          if (geo.district) setDistrict(geo.district);
          if (geo.state) setStateName(geo.state);

          const summary = [geo.village, geo.district, geo.state]
            .filter(Boolean)
            .join(", ");
          setLocationNote(
            t("app.locationFound", {
              summary: summary || `${lat}, ${lng}`,
              pincode: geo.pincode
                ? ` (${t("app.pincode")}: ${geo.pincode})`
                : "",
            }),
          );
          push(t("app.locationDetected"), "success");
        } catch {
          setLocationNote(
            t("app.locationCaptured", { coords: `${lat}, ${lng}` }),
          );
          push(t("app.coordinatesCaptured"), "info");
        } finally {
          setLocating(false);
        }
      },
      (positionError) => {
        setLocating(false);
        setLocationError(
          positionError.code === positionError.PERMISSION_DENIED
            ? t("app.locationPermissionBlocked")
            : positionError.code === positionError.TIMEOUT
              ? t("app.locationTimeout")
              : t("app.locationUnavailable"),
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    if (!village.trim()) {
      setSaving(false);
      setError(t("app.enterVillage"));
      return;
    }
    if (isOwner && rcNumber.trim() && !rcNumberValid) {
      setSaving(false);
      setError(t("app.invalidRc"));
      return;
    }
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          village: village.trim(),
          address: address.trim(),
          pincode: pincode.trim(),
          district: district.trim(),
          state: stateName.trim(),
          lat: coords.lat,
          lng: coords.lng,
          ...(isOwner
            ? {
                serviceRadiusKm: Number(serviceRadiusKm) || 15,
                documents: {
                  dlPhoto: dlPhoto || null,
                  rcNumber: rcNumber.trim() || null,
                  rcPhoto: rcPhoto || null,
                },
              }
            : {}),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? t("app.couldNotSaveProfile"));
      setSaved(true);
      push(t("app.profileUpdated"), "success");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("app.couldNotSaveProfile"));
    } finally {
      setSaving(false);
    }
  }

  function changeLanguage(next: Language) {
    setLanguage(next);
    push(t("app.languageUpdated"), "success");
  }

  async function uploadDocument(kind: "dl" | "rc", file: File) {
    setUploadingDoc(kind);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        throw new Error(result.error ?? t("app.uploadFailed"));
      }
      if (kind === "dl") setDlPhoto(result.url);
      else setRcPhoto(result.url);
      setSaved(false);
      push(
        kind === "dl" ? t("app.dlUploaded") : t("app.rcUploaded"),
        "success",
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : t("app.uploadFailed"),
      );
    } finally {
      setUploadingDoc(null);
    }
  }

  function removeDocument(kind: "dl" | "rc") {
    if (kind === "dl") {
      setDlPhoto("");
      if (dlInputRef.current) dlInputRef.current.value = "";
    } else {
      setRcPhoto("");
      if (rcInputRef.current) rcInputRef.current.value = "";
    }
    setSaved(false);
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <Badge tone="green" dot>{roleLabel(user.role)}</Badge>
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-stone/70">
            {village ? `${village}${district ? ` · ${district}` : ""}` : t("common.locationNotSet")}
          </span>
        </div>
        <h1 className="mt-2 font-display text-3xl text-forest sm:text-[2.4rem]">
          {t("app.profileTitle")}
        </h1>
        <p className="mt-1 text-sm text-stone">{t("app.profileSub")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr] lg:items-start">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-4 border-b border-line/80 bg-[linear-gradient(120deg,#eaf0e4,#f3ecd9)] px-5 py-5">
              <Avatar name={user.name} size="lg" className="!size-16 !text-xl" />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-2xl text-forest">{user.name}</h2>
                <p className="mt-0.5 text-xs text-stone">
                  {roleLabel(user.role)} · {maskMobile(user.mobile)}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge tone="green">
                    <BadgeCheck className="size-3" /> {t("app.verifiedMobile")}
                  </Badge>
                  <Badge tone="stone">
                    <CalendarDays className="size-3" /> {t("app.memberSince")}{" "}
                    {formatDate(user.createdAt.slice(0, 10))}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-4 sm:p-6">
              {error ? <Alert tone="danger">{error}</Alert> : null}
              {saved ? (
                <Alert tone="success">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="size-3.5" /> {t("app.profileSaved")}
                  </span>
                </Alert>
              ) : null}

              <div>
                <h3 className="text-sm font-semibold text-forest">{t("app.personalDetails")}</h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <Field label={t("app.fullName")} required>
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                    />
                  </Field>
                  <Field label={t("common.mobile")} hint={t("app.mobileUsedForOtp")}>
                    <Input value={`+91 ${user.mobile}`} readOnly disabled />
                  </Field>
                  <Field label={t("app.role")}>
                    <Input value={roleLabel(user.role)} readOnly disabled />
                  </Field>
                  <Field
                    label={t("app.village")}
                    required
                    hint={t("app.villageHint")}
                  >
                    <Input
                      value={village}
                      onChange={(event) => setVillage(event.target.value)}
                      placeholder={t("app.villagePlaceholder")}
                      autoComplete="address-level2"
                    />
                  </Field>
                  <Field label={t("app.pincode")} hint={t("app.pincodeHint")}>
                    <Input
                      value={pincode}
                      onChange={(event) => setPincode(event.target.value)}
                      placeholder="e.g. 500001"
                      maxLength={6}
                      inputMode="numeric"
                    />
                  </Field>
                  <Field label={t("app.address")} className="sm:col-span-2">
                    <Input
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder={t("app.addressPlaceholder")}
                    />
                  </Field>
                  <div className="rounded-2xl border border-line/80 bg-cream/30 p-3.5 sm:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-forest">
                          <MapPin className="size-3.5" /> {t("app.autoDetect")}
                        </p>
                        <p className="mt-0.5 text-[0.65rem] leading-relaxed text-stone">
                          {t("app.autoDetectBody")}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={useMyLocation}
                        loading={locating}
                      >
                        <LocateFixed className="size-3.5" /> {t("app.useCurrentLocation")}
                      </Button>
                    </div>
                    {locationError ? (
                      <p
                        role="alert"
                        className="mt-2 rounded-xl border border-clay/25 bg-clay/8 px-2.5 py-2 text-[0.65rem] leading-relaxed text-clay-dark"
                      >
                        {locationError}
                      </p>
                    ) : null}
                    {locationNote ? (
                      <p
                        role="status"
                        className="mt-2 inline-flex items-start gap-1.5 rounded-xl bg-forest/8 px-2.5 py-1.5 text-[0.62rem] font-semibold leading-relaxed text-forest"
                      >
                        <LocateFixed className="mt-0.5 size-3 shrink-0" /> {locationNote}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[0.6rem] text-stone">
                      {coords.lat && coords.lng
                        ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}${district || stateName ? ` · ${[district, stateName].filter(Boolean).join(", ")}` : ""}${pincode ? ` (${pincode})` : ""}`
                        : t("app.noCoordinates")}
                    </p>
                  </div>
                  {isOwner ? (
                    <Field label={t("app.serviceRadius")} hint="1–50 km">
                      <Input
                        type="number"
                        min="1"
                        max="50"
                        value={serviceRadiusKm}
                        onChange={(event) => setServiceRadiusKm(event.target.value)}
                      />
                    </Field>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-line/80 bg-cream/30 p-4">
                <div className="flex items-start gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-forest/8 text-forest">
                    <Globe2 className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-forest">{t("app.languageTitle")}</p>
                    <p className="mt-0.5 text-[0.65rem] leading-relaxed text-stone">
                      {t("app.languageBody")}
                    </p>
                    <Field label={t("app.appLanguage")} className="mt-2.5">
                      <Select
                        value={language}
                        onChange={(event) => changeLanguage(event.target.value as Language)}
                      >
                        {LANGUAGES.map((item) => (
                          <option key={item.code} value={item.code}>
                            {item.native} · {item.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </div>
              </div>

              {isOwner ? (
                <div className="rounded-2xl border border-line/80 bg-cream/30 p-4">
                  <button
                    type="button"
                    onClick={() => setDocsOpen((open) => !open)}
                    aria-expanded={docsOpen}
                    aria-controls="profile-documents"
                    className="flex w-full items-start justify-between gap-3 text-left"
                  >
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-forest/8 text-forest">
                        <FileCheck className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-forest">{t("app.documentsTitle")}</p>
                        <p className="mt-0.5 text-[0.65rem] leading-relaxed text-stone">
                          {t("app.documentsBody")}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={documentsVerified ? "green" : "stone"} dot>
                        {documentsVerified ? t("app.verified") : t("app.notAdded")}
                      </Badge>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-stone transition-transform",
                          docsOpen && "rotate-180",
                        )}
                      />
                    </div>
                  </button>

                  {docsOpen ? (
                    <div id="profile-documents" className="mt-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-line bg-paper p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-forest">
                              <IdCard className="size-3.5" /> {t("app.drivingLicence")}
                            </p>
                            <Badge tone={dlVerified ? "green" : "stone"}>
                              {dlVerified ? t("app.verified") : t("common.optional")}
                            </Badge>
                          </div>
                          {dlPhoto ? (
                            <Photo
                              src={dlPhoto}
                              alt={t("app.drivingLicenceAlt")}
                              className="mt-2 h-28 w-full rounded-lg border border-line"
                              sizes="(max-width: 640px) 100vw, 320px"
                            />
                          ) : (
                            <div className="mt-2 flex h-28 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-cream/40 text-stone">
                              <IdCard className="size-6 text-forest/40" />
                              <p className="text-[0.62rem]">{t("app.noDl")}</p>
                            </div>
                          )}
                          <input
                            ref={dlInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) void uploadDocument("dl", file);
                            }}
                          />
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              loading={uploadingDoc === "dl"}
                              disabled={uploadingDoc !== null}
                              onClick={() => dlInputRef.current?.click()}
                            >
                              <Upload className="size-3.5" /> {dlPhoto ? t("app.replaceDl") : t("app.uploadDl")}
                            </Button>
                            {dlPhoto ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={uploadingDoc !== null}
                                onClick={() => removeDocument("dl")}
                              >
                                <Trash className="size-3.5" /> {t("common.remove")}
                              </Button>
                            ) : null}
                      </div>
                      <p className="mt-1.5 text-[0.6rem] leading-relaxed text-stone">
                        {t("app.dlNotRequired")}
                      </p>
                    </div>

                    <div className="rounded-xl border border-line bg-paper p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-forest">
                          <FileCheck className="size-3.5" /> {t("app.vehicleRc")}
                        </p>
                        <Badge tone={rcVerified ? "green" : "stone"}>
                          {rcVerified ? t("app.verified") : t("app.notAdded")}
                        </Badge>
                      </div>
                      <Field
                        label={t("app.rcNumber")}
                        className="mt-2"
                        hint={t("app.rcHint")}
                      >
                        <Input
                          value={rcNumber}
                          onChange={(event) => {
                            setRcNumber(event.target.value.toUpperCase());
                            setSaved(false);
                          }}
                          placeholder="MH 15 AB 1234"
                          autoComplete="off"
                        />
                      </Field>
                      {rcPhoto ? (
                        <Photo
                          src={rcPhoto}
                          alt={t("app.vehicleRcAlt")}
                          className="mt-2 h-28 w-full rounded-lg border border-line"
                          sizes="(max-width: 640px) 100vw, 320px"
                        />
                      ) : (
                        <div className="mt-2 flex h-28 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-cream/40 text-stone">
                          <ImagePlus className="size-6 text-forest/40" />
                          <p className="text-[0.62rem]">{t("app.noRcPhoto")}</p>
                        </div>
                      )}
                      <input
                        ref={rcInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadDocument("rc", file);
                        }}
                      />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          loading={uploadingDoc === "rc"}
                          disabled={uploadingDoc !== null}
                          onClick={() => rcInputRef.current?.click()}
                        >
                          <Upload className="size-3.5" /> {rcPhoto ? t("app.replaceRcPhoto") : t("app.uploadRcPhoto")}
                        </Button>
                        {rcPhoto ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={uploadingDoc !== null}
                            onClick={() => removeDocument("rc")}
                          >
                            <Trash className="size-3.5" /> {t("common.remove")}
                          </Button>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-[0.6rem] leading-relaxed text-stone">
                        {t("app.rcEntryHint")}
                      </p>
                    </div>
                      </div>

                      <p className="mt-2.5 flex items-start gap-1.5 text-[0.62rem] leading-relaxed text-stone">
                        <ShieldCheck className="mt-0.5 size-3 shrink-0 text-forest" />
                        {t("app.verifiedExplanation")}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3">
                        <p className="text-[0.62rem] leading-relaxed text-stone">
                          {t("app.documentsSaved")}
                        </p>
                        <Button type="button" size="sm" onClick={save} loading={saving}>
                          <Check className="size-3.5" /> {t("common.save")}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/80 pt-4">
                <p className="text-[0.65rem] leading-relaxed text-stone">
                  {t("app.mobileUsedOnly")}
                </p>
                <Button onClick={save} loading={saving}>
                  <Check className="size-4" /> {t("common.save")}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="font-display text-xl text-forest">{t("app.trustSafety")}</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="flex items-start gap-2.5 rounded-xl bg-cream/50 px-3.5 py-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-forest" />
                <div>
                  <p className="text-xs font-semibold text-forest">{t("app.neverShareSecrets")}</p>
                  <p className="mt-0.5 text-[0.65rem] leading-relaxed text-stone">
                    {t("app.neverShareSecretsBody")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl bg-cream/50 px-3.5 py-3">
                <Wallet className="mt-0.5 size-4 shrink-0 text-forest" />
                <div>
                  <p className="text-xs font-semibold text-forest">{t("app.directPaymentsOnly")}</p>
                  <p className="mt-0.5 text-[0.65rem] leading-relaxed text-stone">
                    {t("app.directPaymentsBody")}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <aside className="space-y-3">
          <Card className="p-4">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-stone">
              {t("app.account")}
            </p>
            <div className="mt-2 space-y-1.5 text-[0.68rem] text-stone">
              <p className="flex items-center justify-between gap-2">
                <span>{t("app.accountType")}</span>
                <span className="font-semibold text-forest">{roleLabel(user.role)}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>{t("app.memberSince")}</span>
                <span className="font-semibold text-forest">
                  {formatDate(user.createdAt.slice(0, 10))}
                </span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>{t("app.village")}</span>
                <span className="font-semibold text-forest">{currentVillage}</span>
              </p>
            </div>
          </Card>

          {isOwner ? (
            <div className="space-y-2">
              <Link
                href="/owner/tractor"
                className="group flex items-center justify-between gap-3 rounded-2xl border border-line/80 bg-paper p-3.5 shadow-[var(--shadow-card)] transition hover:border-forest/25"
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-forest/8 text-forest">
                    <Tractor className="size-4" />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold text-forest">
                      {t("nav.myTractor")}
                    </span>
                    <span className="block text-[0.62rem] text-stone">{t("app.listingRatesEquipment")}</span>
                  </span>
                </span>
                <ArrowRight className="size-3.5 text-stone" />
              </Link>
              <Link
                href="/owner/payments"
                className="group flex items-center justify-between gap-3 rounded-2xl border border-line/80 bg-paper p-3.5 shadow-[var(--shadow-card)] transition hover:border-forest/25"
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-wheat/40 text-[#7a5a1d]">
                    <Wallet className="size-4" />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold text-forest">
                      {t("nav.payments")}
                    </span>
                    <span className="block text-[0.62rem] text-stone">{t("app.upiQrBank")}</span>
                  </span>
                </span>
                <ArrowRight className="size-3.5 text-stone" />
              </Link>
            </div>
          ) : (
            <Link
              href="/explore"
              className="group flex items-center justify-between gap-3 rounded-2xl border border-line/80 bg-paper p-3.5 shadow-[var(--shadow-card)] transition hover:border-forest/25"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-forest/8 text-forest">
                  <Sprout className="size-4" />
                </span>
                <span>
                  <span className="block text-xs font-semibold text-forest">{t("nav.findTractor")}</span>
                  <span className="block text-[0.62rem] text-stone">{t("app.localOwnersNearFarm")}</span>
                </span>
              </span>
              <ArrowRight className="size-3.5 text-stone" />
            </Link>
          )}

          <div className="rounded-2xl border border-line/70 bg-paper/60 p-4">
            <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-stone">
              <MapPin className="size-3.5" /> {t("app.locationTitle")}
            </p>
            <p className="mt-1.5 text-[0.66rem] leading-relaxed text-stone">
              {t("app.locationBody")}
            </p>
            <p className="mt-2 text-[0.62rem] font-semibold text-forest">
              {coords.lat && coords.lng
                ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}${district || stateName ? ` · ${[district, stateName].filter(Boolean).join(", ")}` : ""}${pincode ? ` (${pincode})` : ""}`
                : t("app.noCoordinatesSet")}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-forest/10 bg-forest/5 px-3.5 py-3 text-[0.66rem] leading-relaxed text-forest/80">
            <UserRound className="size-4 shrink-0" />
            <span>
              {isOwner
                ? t("app.serviceRadiusTip")
                : t("app.contactSharedAfterAccept")}
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-clay/25 bg-clay/8 px-3.5 py-3 text-xs font-semibold text-clay-dark transition hover:border-clay/40 hover:bg-clay/15 disabled:opacity-60"
          >
            <LogOut className="size-4" />
            {loggingOut ? t("app.loggingOut") : t("app.logoutAccount")}
          </button>
        </aside>
      </div>
    </div>
  );
}
