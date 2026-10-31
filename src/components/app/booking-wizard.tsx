"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Compass,
  HandCoins,
  Info,
  LocateFixed,
  MapPin,
  Ruler,
  ShieldCheck,
  Sprout,
  Tractor as TractorIcon,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";
import { Photo } from "@/components/ui/photo";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Textarea,
  buttonStyles,
} from "@/components/ui/primitives";
import { useToast } from "@/components/providers/app-providers";
import { PRICING_LABELS, PRICING_UNITS, SERVICES, VILLAGES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { calculateAmount, formatRupees, minutesToHoursLabel } from "@/lib/pricing";
import type {
  BookingDetail,
  BookingFor,
  PricingType,
  ServiceType,
  SessionUser,
  TractorWithOwner,
} from "@/lib/types";
import {
  addDaysISO,
  cn,
  formatDate,
  haversineKm,
  mobileEnding,
  timeToMinutes,
  todayISO,
} from "@/lib/utils";

const SERVICE_EQUIPMENT: Record<ServiceType, string> = {
  ploughing: "eq_plough",
  rotavation: "eq_rotavator",
  trolley: "eq_trolley",
};

const serviceIcons: Record<ServiceType, typeof Wrench> = {
  ploughing: Wrench,
  rotavation: Sprout,
  trolley: Truck,
};

const pricingIcons: Record<PricingType, typeof Clock3> = {
  hourly: Clock3,
  acre: Ruler,
  trip: Truck,
};

/** How far a GPS reading may be from a seeded village and still be named. */
const SERVICE_AREA_KM = 50;

const steps = [
  { title: "Tractor", hint: "Choose the machine" },
  { title: "Work", hint: "Service, rate & time" },
  { title: "Location", hint: "Where & for whom" },
  { title: "Review", hint: "Send the request" },
];

function Stepper({ step }: { step: number }) {
  return (
    <ol className="grid grid-cols-4 gap-1.5">
      {steps.map((item, index) => {
        const done = index < step;
        const active = index === step;
        return (
          <li key={item.title} className="min-w-0">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-xl border px-2 py-2 transition sm:px-2.5",
                active && "border-forest/25 bg-forest/6",
                done && "border-forest/15 bg-paper",
                !active && !done && "border-line/70 bg-paper/50",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold",
                  active && "bg-forest text-cream",
                  done && "bg-forest/10 text-forest",
                  !active && !done && "bg-sand text-stone",
                )}
              >
                {done ? <Check className="size-3" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block truncate text-[0.68rem] font-semibold",
                    active ? "text-forest" : done ? "text-forest/75" : "text-stone/70",
                  )}
                >
                  {item.title}
                </span>
                <span className="hidden truncate text-[0.56rem] text-stone/60 sm:block">
                  {item.hint}
                </span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function TractorChoice({
  tractor,
  selected,
  onSelect,
}: {
  tractor: TractorWithOwner;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-stretch gap-3 rounded-2xl border p-2.5 text-left transition",
        selected
          ? "border-forest bg-forest/5 ring-2 ring-forest/10"
          : "border-line bg-paper hover:border-forest/30",
      )}
    >
      <Photo
        src={tractor.image}
        alt={`${tractor.brand} ${tractor.model}`}
        className="h-20 w-24 shrink-0 rounded-xl sm:h-24 sm:w-28"
        sizes="120px"
      />
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-display text-lg leading-tight text-forest">
              {tractor.brand} {tractor.model}
            </p>
            <p className="mt-0.5 truncate text-[0.68rem] text-stone">
              {tractor.owner.name} · {tractor.village} · {tractor.distanceKm} km
            </p>
          </div>
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full border",
              selected ? "border-forest bg-forest text-cream" : "border-line text-transparent",
            )}
          >
            <Check className="size-3" />
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {tractor.pricing.hourlyEnabled ? (
            <span className="rounded-md bg-cream px-1.5 py-0.5 text-[0.6rem] font-semibold text-forest">
              {formatRupees(tractor.pricing.hourlyRate)}/hr
            </span>
          ) : null}
          {tractor.pricing.acreEnabled ? (
            <span className="rounded-md bg-cream px-1.5 py-0.5 text-[0.6rem] font-semibold text-forest">
              {formatRupees(tractor.pricing.acreRate)}/acre
            </span>
          ) : null}
          {tractor.pricing.tripEnabled ? (
            <span className="rounded-md bg-cream px-1.5 py-0.5 text-[0.6rem] font-semibold text-forest">
              {formatRupees(tractor.pricing.tripRate)}/trip
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 line-clamp-1 text-[0.62rem] text-stone/75">
          {tractor.equipment.map((item) => item.name).join(" · ")}
        </p>
      </div>
    </button>
  );
}

export function BookingWizard({
  user,
  initialTractorId,
  initialForOther,
}: {
  user: SessionUser;
  initialTractorId?: string;
  initialForOther: boolean;
}) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { push } = useToast();
  const { t, serviceLabel } = useI18n();
  const [step, setStep] = useState(initialTractorId ? 1 : 0);
  const [tractorId, setTractorId] = useState(initialTractorId ?? "");
  const [serviceType, setServiceType] = useState<ServiceType>("ploughing");
  const [pricingType, setPricingType] = useState<PricingType>("hourly");
  const [hours, setHours] = useState("2");
  const [acres, setAcres] = useState("2");
  const [trips, setTrips] = useState("2");
  const [date, setDate] = useState(addDaysISO(1));
  const [time, setTime] = useState("09:00");
  const [bookingFor, setBookingFor] = useState<BookingFor>(
    initialForOther ? "other" : "self",
  );
  const [recipientName, setRecipientName] = useState("");
  const [recipientMobile, setRecipientMobile] = useState("");
  const profileVillageName = user.farmerProfile?.village?.trim() ?? "";
  const defaultVillage = VILLAGES.find(
    (village) => village.name === profileVillageName,
  ) ?? VILLAGES[0];
  const [villageName, setVillageName] = useState(
    profileVillageName || defaultVillage.name,
  );
  const [farmLabel, setFarmLabel] = useState(
    user.farmerProfile?.address && user.farmerProfile.address !== defaultVillage.name
      ? user.farmerProfile.address
      : "",
  );
  const [note, setNote] = useState("");
  const [coords, setCoords] = useState({
    lat: user.farmerProfile?.lat ?? defaultVillage.lat,
    lng: user.farmerProfile?.lng ?? defaultVillage.lng,
  });
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [created, setCreated] = useState<BookingDetail | null>(null);

  const { data: listData, isLoading: listLoading } = useSWR<{
    tractors: TractorWithOwner[];
  }>("/api/tractors");
  const tractors = listData?.tractors ?? [];
  const selectedFromList = tractors.find((tractor) => tractor.id === tractorId);
  const { data: detailData } = useSWR<{ tractor: TractorWithOwner }>(
    tractorId && !selectedFromList ? `/api/tractors/${tractorId}` : null,
  );
  const selectedTractor = selectedFromList ?? detailData?.tractor;

  const supportedServices = useMemo(() => {
    if (!selectedTractor) return SERVICES;
    const supported = SERVICES.filter((service) =>
      selectedTractor.equipmentIds.includes(SERVICE_EQUIPMENT[service.id]),
    );
    return supported.length > 0 ? supported : SERVICES;
  }, [selectedTractor]);

  const enabledPricing = useMemo(() => {
    if (!selectedTractor) return ["hourly", "acre", "trip"] as PricingType[];
    const rows: PricingType[] = [];
    if (selectedTractor.pricing.hourlyEnabled) rows.push("hourly");
    if (selectedTractor.pricing.acreEnabled) rows.push("acre");
    if (selectedTractor.pricing.tripEnabled) rows.push("trip");
    return rows.length > 0 ? rows : (["hourly"] as PricingType[]);
  }, [selectedTractor]);

  useEffect(() => {
    if (!selectedTractor) return;
    if (!supportedServices.some((service) => service.id === serviceType)) {
      // Reset to the first supported option when the chosen tractor changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setServiceType(supportedServices[0].id);
    }
    if (!enabledPricing.includes(pricingType)) {
      setPricingType(enabledPricing[0]);
    }
    // Only re-check when the tractor changes; manual selections are preserved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTractor?.id]);

  const minutes = Math.round(Number(hours) * 60);
  const acresValue = Number(acres);
  const tripsValue = Math.round(Number(trips));
  const rate = selectedTractor
    ? pricingType === "hourly"
      ? selectedTractor.pricing.hourlyRate
      : pricingType === "acre"
        ? selectedTractor.pricing.acreRate
        : selectedTractor.pricing.tripRate
    : 0;
  const estimate = selectedTractor
    ? calculateAmount(pricingType, rate, {
        minutes: pricingType === "hourly" ? minutes : null,
        acres: pricingType === "acre" ? acresValue : null,
        trips: pricingType === "trip" ? tripsValue : null,
      })
    : 0;

  const selectedVillage =
    VILLAGES.find(
      (village) => village.name.toLowerCase() === villageName.trim().toLowerCase(),
    ) ??
    VILLAGES.reduce(
      (best, village) => {
        const distance = haversineKm(coords, village);
        return distance < best.distance ? { village, distance } : best;
      },
      { village: VILLAGES[0], distance: Number.POSITIVE_INFINITY },
    ).village;

  function chooseVillage(name: string) {
    setVillageName(name);
    const village = VILLAGES.find(
      (item) => item.name.toLowerCase() === name.trim().toLowerCase(),
    );
    if (village) setCoords({ lat: village.lat, lng: village.lng });
  }

  function useMyLocation() {
    setError(null);
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError(
        "Location sharing needs a secure https connection. Choose your village instead.",
      );
      return;
    }
    if (!navigator.geolocation) {
      setError("Your browser cannot share location. Choose your village instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Math.round(position.coords.latitude * 10000) / 10000;
        const lng = Math.round(position.coords.longitude * 10000) / 10000;
        setCoords({ lat, lng });
        const nearest = VILLAGES.reduce(
          (best, village) => {
            const distance = haversineKm({ lat, lng }, village);
            return distance < best.distance ? { village, distance } : best;
          },
          { village: VILLAGES[0], distance: Number.POSITIVE_INFINITY },
        );
        const isCustomVillage =
          villageName.trim() !== "" &&
          !VILLAGES.some(
            (village) => village.name.toLowerCase() === villageName.trim().toLowerCase(),
          );
        // Keep a typed village name when the reading is outside the area the
        // seeded villages cover; the GPS coordinates are still used.
        if (!isCustomVillage && nearest.distance <= SERVICE_AREA_KM) {
          setVillageName(nearest.village.name);
        }
        setLocating(false);
        push(
          nearest.distance <= SERVICE_AREA_KM
            ? "Location captured for this booking."
            : "Location captured. Please confirm the village name for this booking.",
          "success",
        );
      },
      (positionError) => {
        setLocating(false);
        setError(
          positionError.code === positionError.PERMISSION_DENIED
            ? "Location permission is blocked. Allow location for this site, or choose your village instead."
            : positionError.code === positionError.TIMEOUT
              ? "Location took too long. Try again, or choose your village instead."
              : "Could not read your location. Choose your village instead.",
        );
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  }

  function validateStep(current: number): string | null {
    if (current === 0) {
      if (!selectedTractor) return "Please choose a tractor.";
      if (!selectedTractor.isAvailable)
        return "This owner is offline for new requests. Choose another tractor.";
    }
    if (current === 1) {
      if (!selectedTractor) return "Please choose a tractor.";
      if (!supportedServices.some((service) => service.id === serviceType))
        return "This tractor does not have the equipment for that work.";
      if (!enabledPricing.includes(pricingType))
        return "Choose an available pricing option.";
      if (pricingType === "hourly") {
        if (!Number.isFinite(minutes) || minutes < 30 || minutes > 12 * 60)
          return "Enter an estimated time between 30 minutes and 12 hours.";
      }
      if (pricingType === "acre") {
        if (!Number.isFinite(acresValue) || acresValue <= 0 || acresValue > 100)
          return "Enter an acreage between 0 and 100.";
      }
      if (pricingType === "trip") {
        if (!Number.isFinite(tripsValue) || tripsValue < 1 || tripsValue > 20)
          return "Choose between 1 and 20 trips.";
      }
      if (!date || date < todayISO()) return "Choose today or a future date.";
      if (!/^\d{2}:\d{2}$/.test(time)) return "Choose a valid start time.";
      if (date === todayISO()) {
        const now = new Date();
        if (timeToMinutes(time) < now.getHours() * 60 + now.getMinutes() + 30) {
          return "For today, choose a start time at least 30 minutes from now.";
        }
      }
    }
    if (current === 2) {
      if (bookingFor === "other") {
        if (!recipientName.trim()) return "Please enter the recipient’s name.";
        if (!/^[6-9]\d{9}$/.test(recipientMobile.replace(/\D/g, "")))
          return "Please enter a valid 10-digit recipient mobile number.";
      }
      if (!farmLabel.trim()) return "Add the farm address or a landmark.";
      if (!villageName.trim()) return "Choose or type the service village.";
    }
    return null;
  }

  function goNext() {
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setStep((current) => Math.min(3, current + 1));
  }

  async function submit() {
    const message = validateStep(1) ?? validateStep(2);
    if (message) {
      setError(message);
      return;
    }
    if (!selectedTractor) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tractorId: selectedTractor.id,
          bookingFor,
          recipientName: bookingFor === "other" ? recipientName.trim() : undefined,
          recipientMobile:
            bookingFor === "other" ? recipientMobile.replace(/\D/g, "") : undefined,
          serviceLocation: {
            label: farmLabel.trim(),
            village: villageName.trim(),
            district: selectedVillage.district,
            state: selectedVillage.state,
            lat: coords.lat,
            lng: coords.lng,
            note: note.trim(),
          },
          serviceType,
          pricingType,
          bookingDate: date,
          startTime: time,
          estimatedMinutes: pricingType === "hourly" ? minutes : undefined,
          estimatedAcres: pricingType === "acre" ? acresValue : undefined,
          estimatedTrips: pricingType === "trip" ? tripsValue : undefined,
          note: note.trim(),
        }),
      });
      const data = (await response.json()) as { error?: string; booking?: BookingDetail };
      if (!response.ok) throw new Error(data.error ?? "Could not send this booking request.");
      setCreated(data.booking ?? null);
      push("Booking request sent to the owner.", "success");
      await mutate(
        (key) => typeof key === "string" && key.startsWith("/api/"),
        undefined,
        { revalidate: true },
      );
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not send this booking request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-[1.75rem] border border-line bg-paper shadow-soft">
          <div className="relative bg-forest px-6 py-8 text-center text-cream">
            <div className="pointer-events-none absolute inset-0 opacity-[0.09] [background-image:radial-gradient(#f7f2e6_1px,transparent_1px)] [background-size:22px_22px]" />
            <span className="relative mx-auto flex size-14 items-center justify-center rounded-full bg-wheat text-forest">
              <CheckCircle2 className="size-7" />
            </span>
            <h1 className="relative mt-4 font-display text-3xl">{t("app.requestSent")}</h1>
            <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed text-cream/70">
              {t("app.requestSentBody", { name: created.owner.name })}
            </p>
          </div>
          <div className="space-y-4 p-5 sm:p-6">
            <div className="rounded-2xl border border-line bg-cream/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone="amber" dot>
                  {t("status.PENDING")}
                </Badge>
                <span className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-stone">
                  {created.id}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2">
                  <span className="text-stone">{t("common.tractor")}</span>
                  <span className="font-semibold text-forest">
                    {created.tractor.brand} {created.tractor.model}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2">
                  <span className="text-stone">{t("common.service")}</span>
                  <span className="font-semibold text-forest">
                    {serviceLabel(created.serviceType)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2">
                  <span className="text-stone">{t("common.date")}</span>
                  <span className="font-semibold text-forest">
                    {formatDate(created.bookingDate)} · {created.startTime}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2">
                  <span className="text-stone">{t("common.estimated")}</span>
                  <span className="font-semibold text-forest">
                    {formatRupees(created.estimatedAmount)}
                  </span>
                </div>
              </div>
              {created.bookingFor === "other" ? (
                <p className="mt-2 text-[0.68rem] text-clay-dark">
                  Booked for {created.recipientName} · {created.recipientMobile}
                </p>
              ) : null}
            </div>

            <Alert tone="info" title={t("app.noPaymentNow")}>
              The owner must accept before the work is scheduled. You will see the update in
              Bookings. Payment is always made directly to the owner after the final bill.
            </Alert>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href={`/bookings/${created.id}`}
                className={buttonStyles("primary", "md", "flex-1")}
              >
                {t("app.viewBooking")} <ArrowRight className="size-4" />
              </Link>
              <Link href="/explore" className={buttonStyles("outline", "md", "flex-1")}>
                {t("app.backToExplore")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={selectedTractor ? `/tractors/${selectedTractor.id}` : "/explore"}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone transition hover:text-forest"
        >
          <ArrowLeft className="size-3.5" /> {selectedTractor ? "Back to tractor" : "Back to explore"}
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[0.65rem] font-semibold text-stone/70">
          <ShieldCheck className="size-3.5 text-moss" /> No payment now · Owner confirms first
        </span>
      </div>

      <div>
        <span className="eyebrow">Book farm work</span>
        <h1 className="mt-2 font-display text-3xl text-forest sm:text-[2.4rem]">
          {step === 0
            ? "Choose a tractor near your farm."
            : step === 1
              ? "Choose the work and the rate."
              : step === 2
                ? "Where is the work, and who is it for?"
                : "Review before you send."}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-stone">
          The rate you choose is saved with the request. The final bill uses actual active work or
          measured work, and you pay the owner directly.
        </p>
      </div>

      <Stepper step={step} />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_0.72fr] lg:items-start">
        <Card className="p-4 sm:p-6">
          {error ? (
            <Alert tone="danger" className="mb-4">
              {error}
            </Alert>
          ) : null}

          {step === 0 ? (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-xl text-forest">Available tractors</h2>
                <p className="mt-1 text-xs text-stone">
                  These owners are online and can receive a request now.
                </p>
              </div>
              {listLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-28 animate-pulse rounded-2xl bg-sand/70" />
                  ))}
                </div>
              ) : tractors.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-line p-6 text-center">
                  <TractorIcon className="mx-auto size-7 text-stone/50" />
                  <p className="mt-2 font-display text-lg text-forest">No tractors online now</p>
                  <p className="mt-1 text-xs text-stone">
                    Check again later or ask a local owner directly.
                  </p>
                  <Link href="/explore" className={buttonStyles("outline", "sm", "mt-3")}>
                    Back to explore
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {tractors.map((tractor) => (
                    <TractorChoice
                      key={tractor.id}
                      tractor={tractor}
                      selected={tractor.id === tractorId}
                      onSelect={() => {
                        setTractorId(tractor.id);
                        setError(null);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {step === 1 && selectedTractor ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-2xl border border-line/80 bg-cream/40 p-3">
                <Photo
                  src={selectedTractor.image}
                  alt={`${selectedTractor.brand} ${selectedTractor.model}`}
                  className="h-16 w-20 shrink-0 rounded-xl"
                  sizes="90px"
                  priority
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg text-forest">
                    {selectedTractor.brand} {selectedTractor.model}
                  </p>
                  <p className="truncate text-[0.68rem] text-stone">
                    {selectedTractor.owner.name} · {selectedTractor.village} ·{" "}
                    {selectedTractor.distanceKm} km
                  </p>
                </div>
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="shrink-0 text-[0.65rem] font-semibold text-clay hover:underline"
                  >
                    Change
                  </button>
                ) : null}
              </div>

              <div>
                <h2 className="text-sm font-semibold text-forest">{t("app.chooseService")}</h2>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {supportedServices.map((service) => {
                    const Icon = serviceIcons[service.id];
                    const active = serviceType === service.id;
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => setServiceType(service.id)}
                        className={cn(
                          "flex items-start gap-2.5 rounded-xl border p-3 text-left transition",
                          active
                            ? "border-forest bg-forest/6"
                            : "border-line bg-paper hover:border-forest/25",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg",
                            active ? "bg-forest text-cream" : "bg-forest/8 text-forest",
                          )}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-forest">
                            {serviceLabel(service.id)}
                          </span>
                          <span className="mt-0.5 block text-[0.64rem] leading-relaxed text-stone">
                            {service.short}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-forest">{t("app.choosePricing")}</h2>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {enabledPricing.map((option) => {
                    const Icon = pricingIcons[option];
                    const active = pricingType === option;
                    const optionRate =
                      option === "hourly"
                        ? selectedTractor.pricing.hourlyRate
                        : option === "acre"
                          ? selectedTractor.pricing.acreRate
                          : selectedTractor.pricing.tripRate;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setPricingType(option)}
                        className={cn(
                          "rounded-xl border p-3 text-left transition",
                          active
                            ? "border-forest bg-forest/6"
                            : "border-line bg-paper hover:border-forest/25",
                        )}
                      >
                        <span className="flex items-center justify-between">
                          <Icon className="size-4 text-forest" />
                          {active ? <Check className="size-3.5 text-forest" /> : null}
                        </span>
                        <span className="mt-2 block text-xs font-semibold text-forest">
                          {PRICING_LABELS[option]}
                        </span>
                        <span className="mt-0.5 block font-display text-lg text-forest">
                          {formatRupees(optionRate)}
                          <span className="text-[0.6rem] font-normal text-stone">
                            {PRICING_UNITS[option]}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {pricingType === "hourly" ? (
                <Field
                  label="How long do you expect the work to take?"
                  hint="Only active time is billed"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {["1", "2", "3", "4", "6"].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setHours(value)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          hours === value
                            ? "border-forest bg-forest text-cream"
                            : "border-line bg-paper text-stone hover:border-forest/25",
                        )}
                      >
                        {value} hr
                      </button>
                    ))}
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min="0.5"
                        max="12"
                        step="0.5"
                        value={hours}
                        onChange={(event) => setHours(event.target.value)}
                        className="h-9 w-20 text-xs"
                      />
                      <span className="text-xs text-stone">hours</span>
                    </div>
                  </div>
                  <p className="mt-1 text-[0.65rem] text-stone">
                    {minutesToHoursLabel(Math.max(0, minutes))} estimated · breaks are not billed.
                  </p>
                </Field>
              ) : pricingType === "acre" ? (
                <Field
                  label="How many acres need work?"
                  hint={`Rate ${formatRupees(selectedTractor.pricing.acreRate)} / acre`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {["1", "2", "3", "5"].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setAcres(value)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          acres === value
                            ? "border-forest bg-forest text-cream"
                            : "border-line bg-paper text-stone hover:border-forest/25",
                        )}
                      >
                        {value} acre
                      </button>
                    ))}
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min="0.1"
                        max="100"
                        step="0.1"
                        value={acres}
                        onChange={(event) => setAcres(event.target.value)}
                        className="h-9 w-20 text-xs"
                      />
                      <span className="text-xs text-stone">acres</span>
                    </div>
                  </div>
                </Field>
              ) : (
                <Field
                  label="How many trips do you need?"
                  hint={`Rate ${formatRupees(selectedTractor.pricing.tripRate)} / trip`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {["1", "2", "3", "4"].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTrips(value)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          trips === value
                            ? "border-forest bg-forest text-cream"
                            : "border-line bg-paper text-stone hover:border-forest/25",
                        )}
                      >
                        {value} trip
                      </button>
                    ))}
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min="1"
                        max="20"
                        step="1"
                        value={trips}
                        onChange={(event) => setTrips(event.target.value)}
                        className="h-9 w-20 text-xs"
                      />
                      <span className="text-xs text-stone">trips</span>
                    </div>
                  </div>
                </Field>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("app.workDate")} required>
                  <Input
                    type="date"
                    min={todayISO()}
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </Field>
                <Field label={t("app.startTime")} required>
                  <Input
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                  />
                </Field>
              </div>
              <p className="flex items-start gap-2 text-[0.68rem] leading-relaxed text-stone">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                For today, choose a start time at least 30 minutes from now. The owner may suggest
                a different time if the tractor is already booked.
              </p>

              <div className="flex items-center justify-between rounded-2xl bg-forest/5 px-4 py-3">
                <div>
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-stone">
                    {t("app.estimate")}
                  </p>
                  <p className="text-[0.65rem] text-stone">
                    {PRICING_LABELS[pricingType]} · {formatRupees(rate)}
                    {PRICING_UNITS[pricingType]}
                  </p>
                </div>
                <p className="font-display text-2xl text-forest">{formatRupees(estimate)}</p>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-forest">{t("app.bookingFor")}</h2>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBookingFor("self")}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border p-3 text-left transition",
                      bookingFor === "self"
                        ? "border-forest bg-forest/6"
                        : "border-line bg-paper hover:border-forest/25",
                    )}
                  >
                    <UserRound className="mt-0.5 size-4 shrink-0 text-forest" />
                    <span>
                      <span className="block text-sm font-semibold text-forest">
                        {t("app.myself")}
                      </span>
                      <span className="mt-0.5 block text-[0.64rem] text-stone">
                        Work on my own farm
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingFor("other")}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border p-3 text-left transition",
                      bookingFor === "other"
                        ? "border-forest bg-forest/6"
                        : "border-line bg-paper hover:border-forest/25",
                    )}
                  >
                    <UserRound className="mt-0.5 size-4 shrink-0 text-clay" />
                    <span>
                      <span className="block text-sm font-semibold text-forest">
                        {t("app.someoneElse")}
                      </span>
                      <span className="mt-0.5 block text-[0.64rem] text-stone">
                        For family · no account needed
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              {bookingFor === "other" ? (
                <div className="grid gap-3 rounded-2xl border border-clay/15 bg-clay/5 p-3.5 sm:grid-cols-2">
                  <Field label={t("app.recipientName")} required>
                    <Input
                      value={recipientName}
                      onChange={(event) => setRecipientName(event.target.value)}
                      placeholder="Sunita Patil"
                      autoComplete="name"
                    />
                  </Field>
                  <Field label={t("app.recipientMobile")} required>
                    <Input
                      inputMode="numeric"
                      maxLength={10}
                      value={recipientMobile}
                      onChange={(event) =>
                        setRecipientMobile(event.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                      placeholder="98765 43210"
                      autoComplete="tel"
                    />
                  </Field>
                  <p className="text-[0.65rem] leading-relaxed text-stone sm:col-span-2">
                    {t("app.recipientNote")}
                  </p>
                </div>
              ) : null}

              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-forest">{t("app.serviceLocation")}</h2>
                  <button
                    type="button"
                    onClick={useMyLocation}
                    disabled={locating}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[0.65rem] font-semibold text-forest transition hover:border-forest/30 disabled:opacity-60"
                  >
                    <LocateFixed className={cn("size-3.5", locating && "animate-spin")} />
                    {locating ? "Locating…" : t("common.useMyLocation")}
                  </button>
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <Field
                    label={t("app.village")}
                    required
                    hint="Type the village name. We fill the map location when it matches a known village, or use your current location."
                  >
                    <Input
                      value={villageName}
                      onChange={(event) => chooseVillage(event.target.value)}
                      placeholder="Type your village name"
                      autoComplete="address-level2"
                    />
                  </Field>
                  <Field label={t("app.farmAddress")} required>
                    <Input
                      value={farmLabel}
                      onChange={(event) => setFarmLabel(event.target.value)}
                      placeholder="Patil farm, near the water tank"
                    />
                  </Field>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-cream/60 px-3 py-2 text-[0.65rem] text-stone">
                  <MapPin className="size-3.5 text-forest" />
                  <span>
                    {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </span>
                  <span className="size-1 rounded-full bg-line" />
                  <span>{selectedVillage.district}, {selectedVillage.state}</span>
                </div>
              </div>

              <Field label={t("app.noteOwner")} hint={t("app.noteOwnerHint")}>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Please use the east-side farm entrance. The crop is onion."
                  maxLength={500}
                />
              </Field>

              <Alert tone="info">
                Contact details are shared with the owner after the booking is accepted. The owner
                uses the location and note to reach your field.
              </Alert>
            </div>
          ) : null}

          {step === 3 && selectedTractor ? (
            <div className="space-y-4">
              <h2 className="font-display text-xl text-forest">Booking review</h2>
              <div className="rounded-2xl border border-line bg-cream/40 p-4">
                <div className="flex items-center gap-3">
                  <Photo
                    src={selectedTractor.image}
                    alt={`${selectedTractor.brand} ${selectedTractor.model}`}
                    className="h-16 w-20 shrink-0 rounded-xl"
                    sizes="90px"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg text-forest">
                      {selectedTractor.brand} {selectedTractor.model}
                    </p>
                    <p className="truncate text-[0.68rem] text-stone">
                      {selectedTractor.owner.name} · {selectedTractor.village}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 space-y-2 border-t border-line/80 pt-3 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-stone">{t("common.service")}</dt>
                    <dd className="text-right font-semibold text-forest">
                      {serviceLabel(serviceType)} · {PRICING_LABELS[pricingType]}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-stone">{t("app.agreedRate")}</dt>
                    <dd className="text-right font-semibold text-forest">
                      {formatRupees(rate)}
                      {PRICING_UNITS[pricingType]}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-stone">{t("app.workEstimate")}</dt>
                    <dd className="text-right font-semibold text-forest">
                      {pricingType === "hourly"
                        ? minutesToHoursLabel(Math.max(0, minutes))
                        : pricingType === "acre"
                          ? `${acresValue} acres`
                          : `${tripsValue} trips`}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-stone">{t("app.workDate")}</dt>
                    <dd className="text-right font-semibold text-forest">
                      {formatDate(date)} · {time}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-stone">{t("app.serviceLocation")}</dt>
                    <dd className="max-w-[60%] text-right font-semibold text-forest">
                      {farmLabel}, {villageName}
                    </dd>
                  </div>
                  {bookingFor === "other" ? (
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-stone">For</dt>
                      <dd className="text-right font-semibold text-forest">
                        {recipientName} · ••••••{mobileEnding(recipientMobile)}
                      </dd>
                    </div>
                  ) : null}
                  {note ? (
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-stone">{t("common.notes")}</dt>
                      <dd className="max-w-[60%] text-right text-forest/80">{note}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-wheat/70 bg-wheat/20 px-4 py-3">
                <div>
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#7a5a1d]">
                    {t("app.estimate")}
                  </p>
                  <p className="text-[0.65rem] text-[#7a5a1d]">{t("common.notFinal")}</p>
                </div>
                <p className="font-display text-2xl text-forest">{formatRupees(estimate)}</p>
              </div>

              <Alert tone="warning" title={t("app.noPaymentNow")}>
                {t("common.directPayment")} {t("common.noCommission")}
              </Alert>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-forest/15 bg-forest/5 p-3.5 text-[0.68rem] leading-relaxed text-forest">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(event) => setAgreed(event.target.checked)}
                  className="mt-0.5 size-4 accent-[#163b2a]"
                />
                <span>
                  I understand this is a request, not a confirmed booking. The owner must accept
                  before work is scheduled, and I will pay the owner directly after the final bill.
                </span>
              </label>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line/80 pt-4">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep((current) => Math.max(0, current - 1));
              }}
              disabled={step === 0 || submitting}
              className={buttonStyles("ghost", "md")}
            >
              <ArrowLeft className="size-4" /> {t("common.back")}
            </button>
            {step < 3 ? (
              <Button type="button" onClick={goNext} disabled={step === 0 && !tractorId}>
                {t("common.next")} <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={submit}
                loading={submitting}
                disabled={!agreed}
              >
                {t("app.sendRequest")} <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </Card>

        <aside className="space-y-3 lg:sticky lg:top-24">
          <Card className="overflow-hidden">
            <div className="bg-forest px-4 py-3.5 text-cream">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-wheat/80">
                Booking summary
              </p>
              <p className="mt-1 font-display text-2xl text-cream">
                {formatRupees(estimate)}
              </p>
              <p className="text-[0.65rem] text-cream/55">
                {t("common.estimated")} · {t("common.notFinal")}
              </p>
            </div>
            <div className="space-y-2.5 p-4 text-xs">
              {selectedTractor ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-stone">{t("common.tractor")}</span>
                    <span className="max-w-[62%] text-right font-semibold text-forest">
                      {selectedTractor.brand} {selectedTractor.model}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-stone">{t("common.owner")}</span>
                    <span className="max-w-[62%] text-right font-semibold text-forest">
                      {selectedTractor.owner.name}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-stone">{t("common.service")}</span>
                    <span className="text-right font-semibold text-forest">
                      {serviceLabel(serviceType)}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-stone">{t("common.date")}</span>
                    <span className="text-right font-semibold text-forest">
                      {formatDate(date)} · {time}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-stone">{t("common.location")}</span>
                    <span className="max-w-[62%] text-right font-semibold text-forest">
                      {villageName}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-stone">Choose a tractor to see the summary.</p>
              )}
            </div>
            <div className="border-t border-line/80 px-4 py-3">
              <p className="flex items-start gap-1.5 text-[0.62rem] leading-relaxed text-stone">
                <HandCoins className="mt-0.5 size-3 shrink-0 text-forest" />
                {t("common.directPayment")}
              </p>
            </div>
          </Card>

          <div className="rounded-2xl border border-line/70 bg-paper/60 p-4">
            <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-stone">
              <ShieldCheck className="size-3.5 text-moss" /> What happens next?
            </p>
            <ol className="mt-2.5 space-y-2 text-[0.66rem] leading-relaxed text-stone">
              <li className="flex gap-2">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-forest/10 text-[0.55rem] font-bold text-forest">
                  1
                </span>
                The owner accepts or declines your request.
              </li>
              <li className="flex gap-2">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-forest/10 text-[0.55rem] font-bold text-forest">
                  2
                </span>
                Work starts and active time or measurement is recorded.
              </li>
              <li className="flex gap-2">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-forest/10 text-[0.55rem] font-bold text-forest">
                  3
                </span>
                You review the final bill and pay the owner directly.
              </li>
            </ol>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-line/70 bg-paper/60 px-3.5 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-[0.65rem] font-semibold text-forest">
              <Compass className="size-3.5" /> Booked by {user.name.split(" ")[0]}
            </span>
            <Link href="/explore" className="text-[0.62rem] font-semibold text-clay hover:underline">
              Change tractor
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
