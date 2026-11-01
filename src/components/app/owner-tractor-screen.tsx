"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import {
  Camera,
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
import { cn, haversineKm, reverseGeocode } from "@/lib/utils";

type TractorStatus = "active" | "maintenance" | "inactive";

/** How far a GPS reading may be from a known village and still be adopted. */
const SERVICE_AREA_KM = 50;

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

export function OwnerTractorScreen({ user }: { user: SessionUser }) {
  const { t } = useI18n();
  const { push } = useToast();
  const statusLabel = (status: TractorStatus) => {
    if (status === "maintenance") return t("app.underMaintenanceLabel");
    if (status === "inactive") return t("app.hiddenFromFarmers");
    return t("common.active");
  };
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
  const [formLocationError, setFormLocationError] = useState<string | null>(null);
  const [formLocationNote, setFormLocationNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

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
    setFormLocationError(null);
    setFormLocationNote(null);
    setFormOpen(true);
  }

  function startEdit(tractor: TractorWithOwner) {
    setForm(formFromTractor(tractor));
    setFormCoords({ lat: tractor.lat, lng: tractor.lng });
    setError(null);
    setFormLocationError(null);
    setFormLocationNote(null);
    setFormOpen(true);
  }

  function changeVillageSelection(value: string) {
    update("village", value);
    setFormLocationError(null);
    setFormLocationNote(null);
    const match = VILLAGES.find(
      (item) => item.name.toLowerCase() === value.trim().toLowerCase(),
    );
    if (match) setFormCoords({ lat: match.lat, lng: match.lng });
  }

  function useFormLocation() {
    setFormLocationError(null);
    setFormLocationNote(null);
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setFormLocationError(t("app.locationNeedsHttps"));
      return;
    }
    if (!navigator.geolocation) {
      setFormLocationError(t("app.locationBrowserUnsupported"));
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Math.round(position.coords.latitude * 10000) / 10000;
        const lng = Math.round(position.coords.longitude * 10000) / 10000;
        setFormCoords({ lat, lng });

        try {
          const geo = await reverseGeocode(lat, lng);
          if (geo.village) update("village", geo.village);
          const summary = [geo.village, geo.district].filter(Boolean).join(", ");
          setFormLocationNote(
            summary
              ? t("app.tractorLocationFound", { summary })
              : t("app.tractorCoordinates", { coords: `${lat}, ${lng}` }),
          );
          push(t("app.tractorLocationDetected"), "success");
        } catch {
          setFormLocationNote(
            t("app.tractorCoordinates", { coords: `${lat}, ${lng}` }),
          );
          push(t("app.tractorLocationDetected"), "success");
        } finally {
          setLocating(false);
        }
      },
      (positionError) => {
        setLocating(false);
        setFormLocationError(
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
        throw new Error(result.error ?? t("app.couldNotUploadPhoto"));
      }
      setForm((current) => ({
        ...current,
        image: result.url as string,
        images: [result.url as string, ...current.images.filter((item) => item !== result.url)],
      }));
      push(t("app.photoUploaded"), "success");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t("app.couldNotUploadPhoto"));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setError(null);
    if (!form.brand.trim() || !form.model.trim()) {
      setError(t("app.addBrandModel"));
      return;
    }
    if (!form.equipmentIds.length) {
      setError(t("app.selectEquipment"));
      return;
    }
    if (!form.village.trim()) {
      setError(t("app.chooseTractorVillage"));
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
      if (!response.ok) throw new Error(result.error ?? t("app.couldNotSaveTractor"));
      await mutate();
      push(
        editing ? t("app.tractorUpdated") : t("app.tractorListed"),
        "success",
      );
      setFormOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("app.couldNotSaveTractor"));
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
      if (!response.ok) throw new Error(result.error ?? t("app.couldNotRemoveTractor"));
      await mutate();
      push(t("app.tractorRemoved"), "success");
      setDeleteTarget(null);
    } catch (deleteError) {
      push(
        deleteError instanceof Error
          ? deleteError.message
          : t("app.couldNotRemoveTractor"),
        "error",
      );
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
              {user.ownerProfile?.village ?? "Niphad"}
              {user.ownerProfile?.district ? ` · ${user.ownerProfile.district}` : ""}
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
            {t("app.ownerToggleHint")}
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
                    {tractor.ownerProfile.online
                      ? t("app.ownerOnlineLabel")
                      : t("app.ownerOfflineLabel")}
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
                    {t("common.kmAway", { distance: tractor.distanceKm })}
                  </span>
                </div>

                <p className="flex items-center gap-1 text-[0.68rem] text-stone">
                  <MapPin className="size-3" /> {tractor.village}, {tractor.district} ·{" "}
                  {t("app.serviceRadiusSuffix", { distance: tractor.serviceRadiusKm })}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {tractor.pricing.hourlyEnabled ? (
                    <Badge tone="stone">
                      {formatRupees(tractor.pricing.hourlyRate)}
                      {t("common.perHour")}
                    </Badge>
                  ) : null}
                  {tractor.pricing.acreEnabled ? (
                    <Badge tone="stone">
                      {formatRupees(tractor.pricing.acreRate)}
                      {t("common.perAcre")}
                    </Badge>
                  ) : null}
                  {tractor.pricing.tripEnabled ? (
                    <Badge tone="stone">
                      {formatRupees(tractor.pricing.tripRate)}
                      {t("common.perTrip")}
                    </Badge>
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
                      <Trash2 className="size-3.5" /> {t("common.remove")}
                    </button>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[0.62rem] text-stone">
                    <Power className="size-3" />
                    {tractor.status === "active" ? t("app.visible") : t("app.hidden")}
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
              alt={t("app.tractorPhotoAlt")}
              className="h-20 w-28 shrink-0 rounded-xl border border-line"
              sizes="120px"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-forest">{t("app.photo")}</p>
              <p className="mt-0.5 text-[0.62rem] text-stone">
                {t("app.photoHint")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadPhoto(file);
                    event.target.value = "";
                  }}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadPhoto(file);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  disabled={uploading}
                  className={buttonStyles("outline", "sm")}
                >
                  <Camera className="size-3.5 text-forest" />
                  {t("app.takePhoto")}
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className={buttonStyles("outline", "sm")}
                >
                  {uploading ? (
                    <Upload className="size-3.5 animate-pulse text-forest" />
                  ) : (
                    <ImagePlus className="size-3.5 text-forest" />
                  )}
                  {uploading ? t("common.uploading") : t("app.uploadPhoto")}
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
                hint={t("app.tractorVillageHint")}
              >
                <Input
                  value={form.village}
                  onChange={(event) => changeVillageSelection(event.target.value)}
                  placeholder={t("app.villagePlaceholder")}
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
                      <MapPin className="size-3.5" /> {t("app.tractorLocation")}
                    </p>
                    <p className="mt-0.5 text-[0.65rem] leading-relaxed text-stone">
                      {t("app.tractorLocationHint")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={useFormLocation}
                    loading={locating}
                  >
                    <LocateFixed className="size-3.5" /> {t("app.useCurrentLocation")}
                  </Button>
                </div>
                <p className="mt-2 text-[0.6rem] text-stone">
                  {formCoords.lat.toFixed(4)}, {formCoords.lng.toFixed(4)}
                </p>
                {formLocationError ? (
                  <p
                    role="alert"
                    className="mt-2 rounded-xl border border-clay/25 bg-clay/8 px-2.5 py-2 text-[0.65rem] leading-relaxed text-clay-dark"
                  >
                    {formLocationError}
                  </p>
                ) : null}
                {formLocationNote ? (
                  <p
                    role="status"
                    className="mt-2 inline-flex items-start gap-1.5 rounded-xl bg-forest/8 px-2.5 py-1.5 text-[0.62rem] font-semibold leading-relaxed text-forest"
                  >
                    <LocateFixed className="mt-0.5 size-3 shrink-0" /> {formLocationNote}
                  </p>
                ) : null}
              </div>
              <Field label={t("app.availability")}>
                <Select
                  value={form.status}
                  onChange={(event) => update("status", event.target.value as TractorStatus)}
                >
                  <option value="active">{t("app.availableForBookings")}</option>
                  <option value="maintenance">{t("app.underMaintenance")}</option>
                  <option value="inactive">{t("app.hideFromFarmers")}</option>
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
        title={t("app.removeTractorTitle")}
        description={t("app.removeTractorBody")}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" loading={deleting} onClick={remove}>
              <Trash2 className="size-4" /> {t("app.removeTractor")}
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
