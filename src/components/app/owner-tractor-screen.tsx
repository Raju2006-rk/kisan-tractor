"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import {
  Check,
  ImagePlus,
  LocateFixed,
  MapPin,
  Pencil,
  Plus,
  Power,
  ShieldCheck,
  Tractor as TractorIcon,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import { Photo } from "@/components/ui/photo";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  Toggle,
  buttonStyles,
} from "@/components/ui/primitives";
import { useToast } from "@/components/providers/app-providers";
import { EQUIPMENT_CATALOG, VILLAGES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { formatRupees } from "@/lib/pricing";
import type { SessionUser, TractorWithOwner } from "@/lib/types";
import { cn, haversineKm } from "@/lib/utils";

type TractorStatus = "active" | "maintenance" | "inactive";

type TractorForm = {
  id?: string;
  brand: string;
  model: string;
  registrationNumber: string;
  horsepower: string;
  manufacturingYear: string;
  image: string;
  images: string[];
  status: TractorStatus;
  village: string;
  serviceRadiusKm: string;
  equipmentIds: string[];
  hourlyEnabled: boolean;
  hourlyRate: string;
  acreEnabled: boolean;
  acreRate: string;
  tripEnabled: boolean;
  tripRate: string;
};

function emptyForm(user: SessionUser): TractorForm {
  const profileVillage = user.ownerProfile?.village?.trim() ?? "";
  const village =
    VILLAGES.find((item) => item.name === profileVillage) ?? VILLAGES[0];
  return {
    brand: "",
    model: "",
    registrationNumber: "",
    horsepower: "50",
    manufacturingYear: String(new Date().getFullYear()),
    image: "",
    images: [],
    status: "active",
    village: profileVillage || village.name,
    serviceRadiusKm: String(user.ownerProfile?.serviceRadiusKm ?? 10),
    equipmentIds: ["eq_plough"],
    hourlyEnabled: true,
    hourlyRate: "800",
    acreEnabled: true,
    acreRate: "1200",
    tripEnabled: false,
    tripRate: "1500",
  };
}

function formFromTractor(tractor: TractorWithOwner): TractorForm {
  return {
    id: tractor.id,
    brand: tractor.brand,
    model: tractor.model,
    registrationNumber: tractor.registrationNumber,
    horsepower: String(tractor.horsepower),
    manufacturingYear: String(tractor.manufacturingYear),
    image: tractor.image,
    images: tractor.images,
    status: tractor.status,
    village: tractor.village,
    serviceRadiusKm: String(tractor.serviceRadiusKm),
    equipmentIds: tractor.equipmentIds,
    hourlyEnabled: tractor.pricing.hourlyEnabled,
    hourlyRate: String(tractor.pricing.hourlyRate || 800),
    acreEnabled: tractor.pricing.acreEnabled,
    acreRate: String(tractor.pricing.acreRate || 1200),
    tripEnabled: tractor.pricing.tripEnabled,
    tripRate: String(tractor.pricing.tripRate || 1500),
  };
}

function statusLabel(status: TractorStatus) {
  if (status === "maintenance") return "Under maintenance";
  if (status === "inactive") return "Hidden from farmers";
  return "Active";
}

export function OwnerTractorScreen({ user }: { user: SessionUser }) {
  const { t } = useI18n();
  const { push } = useToast();
  const { data, isLoading, mutate } = useSWR<{ tractors: TractorWithOwner[] }>(
    "/api/tractors?owner=me",
  );
  const tractors = data?.tractors ?? [];
  const [form, setForm] = useState<TractorForm>(() => emptyForm(user));
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TractorWithOwner | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formCoords, setFormCoords] = useState(() => ({
    lat: user.ownerProfile?.lat ?? VILLAGES[0].lat,
    lng: user.ownerProfile?.lng ?? VILLAGES[0].lng,
  }));
  const [locating, setLocating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const editing = Boolean(form.id);

  function update<K extends keyof TractorForm>(key: K, value: TractorForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startAdd() {
    const next = emptyForm(user);
    setForm(next);
    setFormCoords({
      lat: user.ownerProfile?.lat ?? VILLAGES[0].lat,
      lng: user.ownerProfile?.lng ?? VILLAGES[0].lng,
    });
    setError(null);
    setFormOpen(true);
  }

  function startEdit(tractor: TractorWithOwner) {
    setForm(formFromTractor(tractor));
    setFormCoords({ lat: tractor.lat, lng: tractor.lng });
    setError(null);
    setFormOpen(true);
  }

  function changeVillageSelection(value: string) {
    update("village", value);
    const match = VILLAGES.find(
      (item) => item.name.toLowerCase() === value.trim().toLowerCase(),
    );
    if (match) setFormCoords({ lat: match.lat, lng: match.lng });
  }

  function useFormLocation() {
    if (!navigator.geolocation) {
      setError("Your browser cannot detect location. Choose or type your village instead.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Math.round(position.coords.latitude * 10000) / 10000;
        const lng = Math.round(position.coords.longitude * 10000) / 10000;
        setFormCoords({ lat, lng });
        const isCustomVillage =
          form.village.trim() !== "" &&
          !VILLAGES.some(
            (village) => village.name.toLowerCase() === form.village.trim().toLowerCase(),
          );
        if (!isCustomVillage) {
          const nearest = VILLAGES.reduce(
            (best, village) => {
              const distance = haversineKm({ lat, lng }, village);
              return distance < best.distance ? { village, distance } : best;
            },
            { village: VILLAGES[0], distance: Number.POSITIVE_INFINITY },
          );
          update("village", nearest.village.name);
        }
        setLocating(false);
        push("Tractor location detected from your device.", "success");
      },
      () => {
        setLocating(false);
        setError("Location permission was not given. Choose or type your village instead.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setError(null);
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body });
      const result = (await response.json()) as { error?: string; url?: string };
      if (!response.ok || !result.url) {
        throw new Error(result.error ?? "Could not upload this photo.");
      }
      setForm((current) => ({
        ...current,
        image: result.url as string,
        images: [result.url as string, ...current.images.filter((item) => item !== result.url)],
      }));
      push("Photo uploaded.", "success");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload this photo.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setError(null);
    if (!form.brand.trim() || !form.model.trim()) {
      setError("Please add the tractor brand and model.");
      return;
    }
    if (!form.equipmentIds.length) {
      setError("Please select at least one equipment.");
      return;
    }
    if (!form.village.trim()) {
      setError("Choose or type the village where the tractor is based.");
      return;
    }
    setSaving(true);
    try {
      const matchedVillage = VILLAGES.find((item) => item.name === form.village.trim());
      const payload = {
        brand: form.brand.trim(),
        model: form.model.trim(),
        registrationNumber: form.registrationNumber.trim(),
        horsepower: Number(form.horsepower) || 50,
        manufacturingYear: Number(form.manufacturingYear) || new Date().getFullYear(),
        image: form.image || undefined,
        images: form.images.length ? form.images : form.image ? [form.image] : undefined,
        status: form.status,
        village: form.village.trim(),
        district: matchedVillage?.district ?? user.ownerProfile?.district ?? "Nashik",
        state: matchedVillage?.state ?? user.ownerProfile?.state ?? "Maharashtra",
        lat: formCoords.lat,
        lng: formCoords.lng,
        serviceRadiusKm: Number(form.serviceRadiusKm) || 10,
        equipmentIds: form.equipmentIds,
        hourlyEnabled: form.hourlyEnabled,
        hourlyRate: Number(form.hourlyRate) || 0,
        acreEnabled: form.acreEnabled,
        acreRate: Number(form.acreRate) || 0,
        tripEnabled: form.tripEnabled,
        tripRate: Number(form.tripRate) || 0,
      };
      const response = await fetch(
        editing ? `/api/tractors/${form.id}` : "/api/tractors",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not save this tractor.");
      await mutate();
      push(editing ? "Tractor listing updated." : "Tractor listed for local work.", "success");
      setFormOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this tractor.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/tractors/${deleteTarget.id}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not remove this tractor.");
      await mutate();
      push("Tractor removed.", "success");
      setDeleteTarget(null);
    } catch (deleteError) {
      push(deleteError instanceof Error ? deleteError.message : "Could not remove this tractor.", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="green" dot>{t("app.ownerTag")}</Badge>
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-stone/70">
              {user.ownerProfile?.village ?? "Niphad"} · Nashik
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl text-forest sm:text-[2.4rem]">
            {t("app.ownerTractorTitle")}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-stone">{t("app.ownerTractorSub")}</p>
        </div>
        <Button onClick={startAdd}>
          <Plus className="size-4" /> {t("app.ownerTractorAdd")}
        </Button>
      </div>

      <Alert tone="info">
        <span className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Your online/offline switch is in the sidebar. Going offline pauses new requests, but
            accepted and active work continues. Tractor status here controls whether the listing is
            available to farmers.
          </span>
        </span>
      </Alert>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : tractors.length === 0 ? (
        <EmptyState
          icon={<TractorIcon className="size-5" />}
          title={t("app.ownerNoTractor")}
          body={t("app.ownerNoTractorBody")}
          action={
            <Button onClick={startAdd}>
              <Plus className="size-4" /> {t("app.ownerTractorAdd")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tractors.map((tractor) => (
            <Card key={tractor.id} className="overflow-hidden">
              <div className="relative">
                <Photo
                  src={tractor.image}
                  alt={`${tractor.brand} ${tractor.model}`}
                  className="h-40 w-full"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                  <Badge tone={tractor.status === "active" ? "green" : "stone"} dot>
                    {statusLabel(tractor.status)}
                  </Badge>
                  <Badge tone={tractor.ownerProfile.online ? "green" : "stone"} dot>
                    {tractor.ownerProfile.online ? "Owner online" : "Owner offline"}
                  </Badge>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-display text-xl text-forest">
                      {tractor.brand} {tractor.model}
                    </h2>
                    <p className="mt-0.5 text-[0.68rem] text-stone">
                      {tractor.registrationNumber} · {tractor.horsepower} HP ·{" "}
                      {tractor.manufacturingYear}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-wheat/25 px-2 py-1 text-[0.62rem] font-semibold text-[#7a5a1d]">
                    {tractor.distanceKm} km from you
                  </span>
                </div>

                <p className="flex items-center gap-1 text-[0.68rem] text-stone">
                  <MapPin className="size-3" /> {tractor.village}, {tractor.district} ·{" "}
                  {tractor.serviceRadiusKm} km service radius
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {tractor.pricing.hourlyEnabled ? (
                    <Badge tone="stone">
                      {formatRupees(tractor.pricing.hourlyRate)}/hour
                    </Badge>
                  ) : null}
                  {tractor.pricing.acreEnabled ? (
                    <Badge tone="stone">{formatRupees(tractor.pricing.acreRate)}/acre</Badge>
                  ) : null}
                  {tractor.pricing.tripEnabled ? (
                    <Badge tone="stone">{formatRupees(tractor.pricing.tripRate)}/trip</Badge>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-1">
                  {tractor.equipment.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 rounded-md bg-cream px-1.5 py-0.5 text-[0.6rem] text-stone"
                    >
                      <Wrench className="size-2.5" /> {item.name}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-line/70 pt-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(tractor)}
                      className={buttonStyles("outline", "sm")}
                    >
                      <Pencil className="size-3.5" /> {t("common.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(tractor)}
                      className={buttonStyles("danger", "sm")}
                    >
                      <Trash2 className="size-3.5" /> Remove
                    </button>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[0.62rem] text-stone">
                    <Power className="size-3" />
                    {tractor.status === "active" ? "Visible" : "Hidden"}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? t("app.tractorFormTitleEdit") : t("app.tractorFormTitleNew")}
        description={t("app.tractorFormSub")}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeForm}>
              {t("common.cancel")}
            </Button>
            <Button onClick={save} loading={saving} disabled={uploading}>
              <Check className="size-4" /> {editing ? t("common.save") : t("app.saveTractor")}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-cream/40 p-3">
            <Photo
              src={form.image}
              alt="Tractor photo"
              className="h-20 w-28 shrink-0 rounded-xl border border-line"
              sizes="120px"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-forest">{t("app.photo")}</p>
              <p className="mt-0.5 text-[0.62rem] text-stone">
                JPG, PNG or WebP · up to 5 MB. One clear photo helps farmers recognise the tractor.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadPhoto(file);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className={buttonStyles("outline", "sm")}
                >
                  {uploading ? (
                    <Upload className="size-3.5 animate-pulse" />
                  ) : (
                    <ImagePlus className="size-3.5" />
                  )}
                  {uploading ? "Uploading…" : t("app.uploadPhoto")}
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-forest">{t("app.tractorDetails")}</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <Field label={t("app.brand")} required>
                <Input
                  value={form.brand}
                  onChange={(event) => update("brand", event.target.value)}
                  placeholder="Mahindra"
                />
              </Field>
              <Field label={t("app.model")} required>
                <Input
                  value={form.model}
                  onChange={(event) => update("model", event.target.value)}
                  placeholder="575 DI"
                />
              </Field>
              <Field label={t("app.registration")} required>
                <Input
                  value={form.registrationNumber}
                  onChange={(event) => update("registrationNumber", event.target.value.toUpperCase())}
                  placeholder="MH 15 GT 4821"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("app.horsepower")} required>
                  <Input
                    type="number"
                    min="15"
                    max="200"
                    value={form.horsepower}
                    onChange={(event) => update("horsepower", event.target.value)}
                  />
                </Field>
                <Field label={t("app.manufacturingYear")} required>
                  <Input
                    type="number"
                    min="1970"
                    max={new Date().getFullYear() + 1}
                    value={form.manufacturingYear}
                    onChange={(event) => update("manufacturingYear", event.target.value)}
                  />
                </Field>
              </div>
              <Field
                label={t("app.village")}
                required
                hint="Type the village name. We fill the map location when it matches a known village, or use your current location."
              >
                <Input
                  value={form.village}
                  onChange={(event) => changeVillageSelection(event.target.value)}
                  placeholder="Type your village name"
                  autoComplete="address-level2"
                />
              </Field>
              <Field label={t("app.serviceRadius")} hint="1–50 km">
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={form.serviceRadiusKm}
                  onChange={(event) => update("serviceRadiusKm", event.target.value)}
                />
              </Field>
              <div className="rounded-2xl border border-line/80 bg-cream/30 p-3.5 sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-forest">
                      <MapPin className="size-3.5" /> Tractor location
                    </p>
                    <p className="mt-0.5 text-[0.65rem] leading-relaxed text-stone">
                      Use this device’s GPS for the tractor’s map position, or type a village that
                      is not in the list. Farmers only see your tractor within your service radius.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={useFormLocation}
                    loading={locating}
                  >
                    <LocateFixed className="size-3.5" /> Use my current location
                  </Button>
                </div>
                <p className="mt-2 text-[0.6rem] text-stone">
                  {formCoords.lat.toFixed(4)}, {formCoords.lng.toFixed(4)}
                </p>
              </div>
              <Field label={t("app.availability")}>
                <Select
                  value={form.status}
                  onChange={(event) => update("status", event.target.value as TractorStatus)}
                >
                  <option value="active">{t("app.availableForBookings")}</option>
                  <option value="maintenance">{t("app.underMaintenance")}</option>
                  <option value="inactive">Hide from farmers</option>
                </Select>
              </Field>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-forest">{t("app.equipmentAvailable")}</h3>
            <p className="mt-0.5 text-[0.68rem] text-stone">{t("app.equipmentHint")}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {EQUIPMENT_CATALOG.map((equipment) => {
                const checked = form.equipmentIds.includes(equipment.id);
                return (
                  <button
                    key={equipment.id}
                    type="button"
                    onClick={() =>
                      update(
                        "equipmentIds",
                        checked
                          ? form.equipmentIds.filter((id) => id !== equipment.id)
                          : [...form.equipmentIds, equipment.id],
                      )
                    }
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border p-3 text-left transition",
                      checked
                        ? "border-forest bg-forest/6"
                        : "border-line bg-paper hover:border-forest/25",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                        checked
                          ? "border-forest bg-forest text-cream"
                          : "border-line text-transparent",
                      )}
                    >
                      <Check className="size-3" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-forest">
                        {equipment.name}
                      </span>
                      <span className="mt-0.5 block text-[0.64rem] leading-relaxed text-stone">
                        {equipment.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-forest">{t("app.pricingTitle")}</h3>
            <p className="mt-0.5 text-[0.68rem] text-stone">{t("app.pricingHint")}</p>
            <div className="mt-2 space-y-2">
              {(
                [
                  {
                    key: "hourly" as const,
                    enabled: form.hourlyEnabled,
                    rate: form.hourlyRate,
                    label: t("app.hourlyPricing"),
                    rateLabel: t("app.ratePerHour"),
                  },
                  {
                    key: "acre" as const,
                    enabled: form.acreEnabled,
                    rate: form.acreRate,
                    label: t("app.acrePricing"),
                    rateLabel: t("app.ratePerAcre"),
                  },
                  {
                    key: "trip" as const,
                    enabled: form.tripEnabled,
                    rate: form.tripRate,
                    label: t("app.tripPricing"),
                    rateLabel: t("app.ratePerTrip"),
                  },
                ]
              ).map((row) => (
                <div
                  key={row.key}
                  className="grid gap-3 rounded-xl border border-line/80 bg-cream/30 p-3 sm:grid-cols-[1fr_150px] sm:items-center"
                >
                  <Toggle
                    checked={row.enabled}
                    onChange={(next) =>
                      update(
                        row.key === "hourly"
                          ? "hourlyEnabled"
                          : row.key === "acre"
                            ? "acreEnabled"
                            : "tripEnabled",
                        next,
                      )
                    }
                    label={row.label}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone">₹</span>
                    <Input
                      type="number"
                      min="1"
                      step="50"
                      value={row.rate}
                      disabled={!row.enabled}
                      onChange={(event) =>
                        update(
                          row.key === "hourly"
                            ? "hourlyRate"
                            : row.key === "acre"
                              ? "acreRate"
                              : "tripRate",
                          event.target.value,
                        )
                      }
                      aria-label={row.rateLabel}
                      className="h-9"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Remove this tractor?"
        description="Farmers will no longer see this tractor. Bookings already accepted or in progress must be completed or cancelled first."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" loading={deleting} onClick={remove}>
              <Trash2 className="size-4" /> Remove tractor
            </Button>
          </>
        }
      >
        {deleteTarget ? (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-cream/50 p-3">
            <Photo
              src={deleteTarget.image}
              alt={`${deleteTarget.brand} ${deleteTarget.model}`}
              className="h-16 w-20 shrink-0 rounded-lg"
              sizes="80px"
            />
            <div>
              <p className="font-display text-lg text-forest">
                {deleteTarget.brand} {deleteTarget.model}
              </p>
              <p className="text-[0.68rem] text-stone">
                {deleteTarget.registrationNumber} · {deleteTarget.village}
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
