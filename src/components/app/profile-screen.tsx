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
import { LANGUAGES, VILLAGES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import type { Language, SessionUser } from "@/lib/types";
import { cn, formatDate, haversineKm, maskMobile } from "@/lib/utils";

/** Match a GPS reading to the closest seeded service village. */
function nearestVillage(lat: number, lng: number) {
  return VILLAGES.reduce((best, village) => {
    const distance = haversineKm({ lat, lng }, village);
    return distance < best.distance ? { village, distance } : best;
  }, { village: VILLAGES[0], distance: Number.POSITIVE_INFINITY });
}

export function ProfileScreen({ user }: { user: SessionUser }) {
  const { t, language, setLanguage, roleLabel } = useI18n();
  const { push } = useToast();
  const router = useRouter();
  const profile = user.farmerProfile ?? user.ownerProfile;
  const isOwner = user.role === "owner";
  const currentVillage = profile?.village ?? "Niphad";
  const [name, setName] = useState(user.name);
  const [village, setVillage] = useState(currentVillage);
  const [address, setAddress] = useState(profile?.address ?? "");
  const [serviceRadiusKm, setServiceRadiusKm] = useState(
    String(user.ownerProfile?.serviceRadiusKm ?? 10),
  );
  const [coords, setCoords] = useState(() => ({
    lat: profile?.lat ?? VILLAGES[0].lat,
    lng: profile?.lng ?? VILLAGES[0].lng,
  }));
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
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

  const selectedVillage =
    VILLAGES.find((item) => item.name === village) ??
    VILLAGES.find((item) => item.name === currentVillage) ??
    nearestVillage(coords.lat, coords.lng).village;

  function chooseVillage(name: string) {
    setVillage(name);
    const match = VILLAGES.find(
      (item) => item.name.toLowerCase() === name.trim().toLowerCase(),
    );
    if (match) {
      setCoords({ lat: match.lat, lng: match.lng });
      setLocationNote(null);
    }
  }

  function useMyLocation() {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Your browser cannot detect location. Choose your village instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Math.round(position.coords.latitude * 10000) / 10000;
        const lng = Math.round(position.coords.longitude * 10000) / 10000;
        const match = nearestVillage(lat, lng);
        setCoords({ lat, lng });
        setVillage(match.village.name);
        setLocationNote(
          `Detected near ${match.village.name} (${match.distance.toFixed(1)} km from the village centre).`,
        );
        setLocating(false);
        push("Location detected from your device.", "success");
      },
      () => {
        setLocating(false);
        setError("Location permission was not given. Choose your village instead.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
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
      setError("Enter your village name.");
      return;
    }
    if (rcNumber.trim() && !rcNumberValid) {
      setSaving(false);
      setError("Enter a valid RC number, for example MH 15 AB 1234, or upload the RC photo.");
      return;
    }
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          village,
          address: address.trim(),
          lat: coords.lat,
          lng: coords.lng,
          documents: {
            dlPhoto: dlPhoto || null,
            rcNumber: rcNumber.trim() || null,
            rcPhoto: rcPhoto || null,
          },
          ...(isOwner ? { serviceRadiusKm: Number(serviceRadiusKm) || 10 } : {}),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not save your profile.");
      setSaved(true);
      push("Profile updated.", "success");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  function changeLanguage(next: Language) {
    setLanguage(next);
    push("Language preference updated.", "success");
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
        throw new Error(result.error ?? "Could not upload this document.");
      }
      if (kind === "dl") setDlPhoto(result.url);
      else setRcPhoto(result.url);
      setSaved(false);
      push(kind === "dl" ? "Driving licence uploaded." : "RC photo uploaded.", "success");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Could not upload this document.",
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
            {currentVillage} · Nashik
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
                  {isOwner ? "Tractor owner" : "Farmer"} · {maskMobile(user.mobile)}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge tone="green">
                    <BadgeCheck className="size-3" /> Verified mobile
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
                    <Check className="size-3.5" /> Profile saved. Your dashboard now uses these
                    details.
                  </span>
                </Alert>
              ) : null}

              <div>
                <h3 className="text-sm font-semibold text-forest">Personal details</h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <Field label="Full name" required>
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                    />
                  </Field>
                  <Field label="Mobile number" hint="Used for OTP login">
                    <Input value={`+91 ${user.mobile}`} readOnly disabled />
                  </Field>
                  <Field label={t("app.role")}>
                    <Input value={isOwner ? "Tractor owner" : "Farmer"} readOnly disabled />
                  </Field>
                  <Field
                    label={t("app.village")}
                    required
                    hint="Type your village name. We fill the map location when it matches a known village, or use your current location below."
                  >
                    <Input
                      value={village}
                      onChange={(event) => chooseVillage(event.target.value)}
                      placeholder="Type your village name"
                      autoComplete="address-level2"
                    />
                  </Field>
                  <Field label={t("app.address")} className="sm:col-span-2">
                    <Input
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder="House / farm address or landmark"
                    />
                  </Field>
                  <div className="rounded-2xl border border-line/80 bg-cream/30 p-3.5 sm:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-forest">
                          <MapPin className="size-3.5" /> Auto-detect my location
                        </p>
                        <p className="mt-0.5 text-[0.65rem] leading-relaxed text-stone">
                          Use this device’s GPS to fill your village and map position. You can still
                          change the village manually.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={useMyLocation}
                        loading={locating}
                      >
                        <LocateFixed className="size-3.5" /> Use my current location
                      </Button>
                    </div>
                    {locationNote ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-forest/8 px-2.5 py-1 text-[0.62rem] font-semibold text-forest">
                        <LocateFixed className="size-3" /> {locationNote}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[0.6rem] text-stone">
                      {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)} · {selectedVillage.district},{" "}
                      {selectedVillage.state}
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
                    <p className="text-sm font-semibold text-forest">Language</p>
                    <p className="mt-0.5 text-[0.65rem] leading-relaxed text-stone">
                      Available in English and all 22 scheduled Indian languages. Your choice is
                      saved to your account.
                    </p>
                    <Field label="App language" className="mt-2.5">
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
                      <p className="text-sm font-semibold text-forest">Documents & verification</p>
                      <p className="mt-0.5 text-[0.65rem] leading-relaxed text-stone">
                        Add your driving licence if you have one, and your vehicle RC number or RC
                        photo. Documents are optional and can be added later.
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={documentsVerified ? "green" : "stone"} dot>
                      {documentsVerified ? "Verified" : "Not added"}
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
                            <IdCard className="size-3.5" /> Driving licence
                          </p>
                          <Badge tone={dlVerified ? "green" : "stone"}>
                            {dlVerified ? "Verified" : "Optional"}
                          </Badge>
                        </div>
                        {dlPhoto ? (
                          <Photo
                            src={dlPhoto}
                            alt="Driving licence"
                            className="mt-2 h-28 w-full rounded-lg border border-line"
                            sizes="(max-width: 640px) 100vw, 320px"
                          />
                        ) : (
                          <div className="mt-2 flex h-28 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-cream/40 text-stone">
                            <IdCard className="size-6 text-forest/40" />
                            <p className="text-[0.62rem]">No DL added</p>
                          </div>
                        )}
                        <input
                          ref={dlInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/avif"
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
                            <Upload className="size-3.5" /> {dlPhoto ? "Replace DL" : "Upload DL"}
                          </Button>
                          {dlPhoto ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={uploadingDoc !== null}
                              onClick={() => removeDocument("dl")}
                            >
                              <Trash className="size-3.5" /> Remove
                            </Button>
                          ) : null}
                    </div>
                    <p className="mt-1.5 text-[0.6rem] leading-relaxed text-stone">
                      If you do not have a driving licence, leave this empty. It is not required.
                    </p>
                  </div>

                  <div className="rounded-xl border border-line bg-paper p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-forest">
                        <FileCheck className="size-3.5" /> Vehicle RC
                      </p>
                      <Badge tone={rcVerified ? "green" : "stone"}>
                        {rcVerified ? "Verified" : "Not added"}
                      </Badge>
                    </div>
                    <Field
                      label="RC number"
                      className="mt-2"
                      hint="Type the number printed on the RC paper."
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
                        alt="Vehicle RC paper"
                        className="mt-2 h-28 w-full rounded-lg border border-line"
                        sizes="(max-width: 640px) 100vw, 320px"
                      />
                    ) : (
                      <div className="mt-2 flex h-28 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-cream/40 text-stone">
                        <ImagePlus className="size-6 text-forest/40" />
                        <p className="text-[0.62rem]">No RC photo added</p>
                      </div>
                    )}
                    <input
                      ref={rcInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
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
                        <Upload className="size-3.5" /> {rcPhoto ? "Replace RC photo" : "Upload RC photo"}
                      </Button>
                      {rcPhoto ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={uploadingDoc !== null}
                          onClick={() => removeDocument("rc")}
                        >
                          <Trash className="size-3.5" /> Remove
                        </Button>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-[0.6rem] leading-relaxed text-stone">
                      Enter the RC number manually, upload a photo, or do both.
                    </p>
                  </div>
                    </div>

                    <p className="mt-2.5 flex items-start gap-1.5 text-[0.62rem] leading-relaxed text-stone">
                      <ShieldCheck className="mt-0.5 size-3 shrink-0 text-forest" />
                      Verified means the file was uploaded successfully and, for the RC, the number
                      matches the Indian registration format. KisanTractor never asks for a bank OTP,
                      UPI PIN or password.
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3">
                      <p className="text-[0.62rem] leading-relaxed text-stone">
                        Your documents are saved with your profile.
                      </p>
                      <Button type="button" size="sm" onClick={save} loading={saving}>
                        <Check className="size-3.5" /> Save changes
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/80 pt-4">
                <p className="text-[0.65rem] leading-relaxed text-stone">
                  Your mobile number is used only for login and booking coordination.
                </p>
                <Button onClick={save} loading={saving}>
                  <Check className="size-4" /> {t("common.save")}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="font-display text-xl text-forest">Trust & safety</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="flex items-start gap-2.5 rounded-xl bg-cream/50 px-3.5 py-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-forest" />
                <div>
                  <p className="text-xs font-semibold text-forest">Never share secrets</p>
                  <p className="mt-0.5 text-[0.65rem] leading-relaxed text-stone">
                    KisanTractor never asks for your bank OTP, UPI PIN, card PIN or password.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl bg-cream/50 px-3.5 py-3">
                <Wallet className="mt-0.5 size-4 shrink-0 text-forest" />
                <div>
                  <p className="text-xs font-semibold text-forest">Direct payments only</p>
                  <p className="mt-0.5 text-[0.65rem] leading-relaxed text-stone">
                    You pay the tractor owner directly. The platform holds no money and takes no
                    commission.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <aside className="space-y-3">
          <Card className="p-4">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-stone">
              Account
            </p>
            <div className="mt-2 space-y-1.5 text-[0.68rem] text-stone">
              <p className="flex items-center justify-between gap-2">
                <span>Account type</span>
                <span className="font-semibold text-forest">{roleLabel(user.role)}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>Member since</span>
                <span className="font-semibold text-forest">
                  {formatDate(user.createdAt.slice(0, 10))}
                </span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>Village</span>
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
                    <span className="block text-[0.62rem] text-stone">Listing, rates & equipment</span>
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
                    <span className="block text-[0.62rem] text-stone">UPI, QR and bank details</span>
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
                  <span className="block text-xs font-semibold text-forest">Find a tractor</span>
                  <span className="block text-[0.62rem] text-stone">Local owners near your farm</span>
                </span>
              </span>
              <ArrowRight className="size-3.5 text-stone" />
            </Link>
          )}

          <div className="rounded-2xl border border-line/70 bg-paper/60 p-4">
            <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-stone">
              <MapPin className="size-3.5" /> Location
            </p>
            <p className="mt-1.5 text-[0.66rem] leading-relaxed text-stone">
              Your village is used to show nearby tractors and estimate distance. You can still
              choose a different farm location for each booking.
            </p>
            <p className="mt-2 text-[0.62rem] font-semibold text-forest">
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)} · {selectedVillage.district},{" "}
              {selectedVillage.state}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-forest/10 bg-forest/5 px-3.5 py-3 text-[0.66rem] leading-relaxed text-forest/80">
            <UserRound className="size-4 shrink-0" />
            <span>
              {isOwner
                ? "Keep your service radius realistic so farmers nearby can find you."
                : "Your contact details are shared with the owner only after they accept a booking."}
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-clay/25 bg-clay/8 px-3.5 py-3 text-xs font-semibold text-clay-dark transition hover:border-clay/40 hover:bg-clay/15 disabled:opacity-60"
          >
            <LogOut className="size-4" />
            {loggingOut ? "Logging out…" : "Log out of this account"}
          </button>
        </aside>
      </div>
    </div>
  );
}
