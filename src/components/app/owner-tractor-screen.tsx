"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  FileCheck,
  IdCard,
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
import {
  EQUIPMENT_CATALOG,
  TRACTOR_BRANDS,
  TRACTOR_BRANDS_AND_MODELS,
  VILLAGES,
} from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { formatRupees } from "@/lib/pricing";
import type { SessionUser, TractorWithOwner } from "@/lib/types";
import { cn, haversineKm, reverseGeocode } from "@/lib/utils";

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

type DocumentsForm = {
  dlPhoto: string;
  rcPhoto: string;
  rcNumber: string;
};

const EMPTY_COORDS = { lat: 0, lng: 0 };
const WIZARD_STEPS = 4;

function emptyForm(user: SessionUser): TractorForm {
  const profileVillage = user.ownerProfile?.village?.trim() ?? "";
  return {
    brand: "Mahindra",
    model: "575 DI",
    registrationNumber: "",
    horsepower: "50",
    manufacturingYear: String(new Date().getFullYear()),
    image: "",
    images: [],
    status: "active",
    // Never fall back to the first demo village. A wrong default is worse than
    // an empty field because it silently saves the tractor at another place.
    village: profileVillage,
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

function documentsFromUser(user: SessionUser): DocumentsForm {
  const docs = user.ownerProfile?.documents;
  return {
    dlPhoto: docs?.dlPhoto ?? "",
    rcPhoto: docs?.rcPhoto ?? "",
    rcNumber: docs?.rcNumber ?? "",
  };
}

const emptyDocuments: DocumentsForm = { dlPhoto: "", rcPhoto: "", rcNumber: "" };

function profileCoords(user: SessionUser) {
  const lat = user.ownerProfile?.lat ?? 0;
  const lng = user.ownerProfile?.lng ?? 0;
  // Older profiles were seeded with 20.0,73.8 (Nashik). Treat that exact pair
  // as unset so a new listing never starts on a guessed pin.
  const legacyPlaceholder =
    Math.abs(lat - 20.0) < 1e-9 && Math.abs(lng - 73.8) < 1e-9;
  return Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !legacyPlaceholder &&
    !(lat === 0 && lng === 0)
    ? { lat, lng }
    : EMPTY_COORDS;
}

function nearestVillage(lat: number, lng: number, maxKm = 15) {
  let best: { village: (typeof VILLAGES)[number]; distance: number } | null = null;
  for (const village of VILLAGES) {
    const distance = haversineKm({ lat, lng }, village);
    if (distance <= maxKm && (!best || distance < best.distance)) {
      best = { village, distance };
    }
  }
  return best?.village ?? null;
}

function compressImageFile(
  file: File,
  maxDim = 1280,
  quality = 0.82,
): Promise<{ dataUrl: string; blob: Blob }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          const rawUrl = (e.target?.result as string) || "";
          resolve({ dataUrl: rawUrl, blob: file });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ dataUrl, blob });
            } else {
              resolve({ dataUrl, blob: file });
            }
          },
          "image/jpeg",
          quality,
        );
      };
      img.onerror = () => {
        const rawUrl = (e.target?.result as string) || "";
        resolve({ dataUrl: rawUrl, blob: file });
      };
      img.src = (e.target?.result as string) || "";
    };
    reader.onerror = () => {
      resolve({ dataUrl: "", blob: file });
    };
    reader.readAsDataURL(file);
  });
}

export function OwnerTractorScreen({ user }: { user: SessionUser }) {
  const { t, equipmentLabel, equipmentDescription } = useI18n();
  const { push } = useToast();
  const router = useRouter();
  const statusLabel = (status: TractorStatus) => {
    if (status === "maintenance") return t("app.underMaintenanceLabel");
    if (status === "inactive") return t("app.hiddenFromFarmers");
    return t("common.active");
  };
  const { data, isLoading, mutate } = useSWR<{ tractors: TractorWithOwner[] }>(
    "/api/tractors?owner=me",
    { revalidateOnMount: true },
  );
  const tractors = data?.tractors ?? [];
  const [form, setForm] = useState<TractorForm>(() => emptyForm(user));
  const [documents, setDocuments] = useState<DocumentsForm>(emptyDocuments);
  const [step, setStep] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<"dl" | "rc" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TractorWithOwner | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formCoords, setFormCoords] = useState(() => profileCoords(user));
  const [formDistrict, setFormDistrict] = useState<string>(() => user.ownerProfile?.district ?? "");
  const [formState, setFormState] = useState<string>(() => user.ownerProfile?.state ?? "");
  const [formPincode, setFormPincode] = useState<string>(() => user.ownerProfile?.pincode ?? "");
  const [formAddress, setFormAddress] = useState<string>(() => user.ownerProfile?.address ?? "");
  const [locating, setLocating] = useState(false);
  const [formLocationError, setFormLocationError] = useState<string | null>(null);
  const [formLocationNote, setFormLocationNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const dlRef = useRef<HTMLInputElement>(null);
  const rcRef = useRef<HTMLInputElement>(null);

  const editing = Boolean(form.id);

  const availableModels = useMemo(() => {
    if (form.brand && TRACTOR_BRANDS_AND_MODELS[form.brand]) {
      return TRACTOR_BRANDS_AND_MODELS[form.brand];
    }
    return TRACTOR_BRANDS_AND_MODELS["Mahindra"] ?? [];
  }, [form.brand]);

  function update<K extends keyof TractorForm>(key: K, value: TractorForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetLocation(userCoords = profileCoords(user)) {
    setFormCoords(userCoords);
    setFormDistrict(user.ownerProfile?.district ?? "");
    setFormState(user.ownerProfile?.state ?? "");
    setFormPincode(user.ownerProfile?.pincode ?? "");
    setFormAddress(user.ownerProfile?.address ?? "");
    setFormLocationError(null);
    setFormLocationNote(null);
  }

  function startAdd() {
    const next = emptyForm(user);
    setForm(next);
    setDocuments(documentsFromUser(user));
    resetLocation();
    setStep(0);
    setError(null);
    setFormOpen(true);
  }

  function startEdit(tractor: TractorWithOwner) {
    setForm(formFromTractor(tractor));
    setDocuments(documentsFromUser(user));
    setFormCoords({ lat: tractor.lat, lng: tractor.lng });
    setFormDistrict(tractor.district);
    setFormState(tractor.state);
    setStep(0);
    setError(null);
    setFormLocationError(null);
    setFormLocationNote(null);
    setFormOpen(true);
  }

  useEffect(() => {
    if (autoOpened || isLoading) return;
    const onboarding =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("onboarding") === "1";
    if (!onboarding) return;
    if (tractors.length > 0) {
      router.replace("/dashboard");
      return;
    }
    // The wizard is intentionally opened once for a new owner.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoOpened(true);
    startAdd();
    // The rest of the state is derived from the server session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpened, isLoading, tractors.length, router]);

  function changeVillageSelection(value: string) {
    update("village", value);
    setFormLocationError(null);
    setFormLocationNote(null);
    const match = VILLAGES.find(
      (item) => item.name.toLowerCase() === value.trim().toLowerCase(),
    );
    if (match) {
      setFormCoords({ lat: match.lat, lng: match.lng });
      setFormDistrict(match.district);
      setFormState(match.state);
      return;
    }
    // Only reset coordinates if the form does not already hold valid detected GPS coordinates
    if (
      !Number.isFinite(formCoords.lat) ||
      !Number.isFinite(formCoords.lng) ||
      (formCoords.lat === 0 && formCoords.lng === 0)
    ) {
      setFormCoords(EMPTY_COORDS);
      setFormDistrict("");
      setFormState("");
    }
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
        const lat = Math.round(position.coords.latitude * 100000) / 100000;
        const lng = Math.round(position.coords.longitude * 100000) / 100000;
        setFormCoords({ lat, lng });

        try {
          const geo = await reverseGeocode(lat, lng);
          const near = nearestVillage(lat, lng);
          const detected =
            geo.village ||
            (geo.address ? geo.address.split(",")[0].trim() : "") ||
            geo.district ||
            near?.name ||
            "";
          if (detected) update("village", detected);
          if (geo.address) setFormAddress(geo.address);
          if (geo.pincode) setFormPincode(geo.pincode);
          const district = geo.district || near?.district || "";
          const state = geo.state || near?.state || "";
          if (district) setFormDistrict(district);
          if (state) setFormState(state);
          const summary = [detected, district, state].filter(Boolean).join(", ");
          setFormLocationNote(
            summary
              ? `${summary}${geo.pincode ? ` (${geo.pincode})` : ""}`
              : t("app.tractorCoordinates", { coords: `${lat}, ${lng}` }),
          );
          push(t("app.tractorLocationDetected"), "success");
        } catch {
          const near = nearestVillage(lat, lng);
          if (near) {
            update("village", near.name);
            setFormDistrict(near.district);
            setFormState(near.state);
          } else {
            update("village", form.village || `Location (${lat}, ${lng})`);
          }
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
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  function validateStep(index: number): string | null {
    if (index === 0) {
      if (!form.image) return t("app.wizardPhotoRequired");
      if (
        !form.brand.trim() ||
        !form.model.trim() ||
        !form.registrationNumber.trim() ||
        form.registrationNumber.replace(/[\s\-_.]/g, "").length < 3
      ) {
        return t("app.wizardDetailsRequired");
      }
      return null;
    }
    if (index === 1) {
      const year = Number(form.manufacturingYear);
      const horsepower = Number(form.horsepower);
      if (
        !Number.isFinite(year) ||
        year < 1970 ||
        year > new Date().getFullYear() + 1 ||
        !Number.isFinite(horsepower) ||
        horsepower < 15 ||
        horsepower > 200
      ) {
        return t("app.wizardSpecsRequired");
      }
      if (!form.equipmentIds.length) return t("app.wizardEquipmentRequired");
      return null;
    }
    if (index === 2) {
      if (!form.village.trim()) return t("app.wizardLocationRequired");
      const radius = Number(form.serviceRadiusKm);
      if (!Number.isFinite(radius) || radius < 1 || radius > 50) {
        return t("app.wizardLocationRequired");
      }
      const matched = VILLAGES.find(
        (item) => item.name.toLowerCase() === form.village.trim().toLowerCase(),
      );
      const hasCoords =
        Number.isFinite(formCoords.lat) &&
        Number.isFinite(formCoords.lng) &&
        !(formCoords.lat === 0 && formCoords.lng === 0);
      if (!hasCoords && !matched) return t("app.wizardCoordinatesRequired");
      return null;
    }
    if (!documents.dlPhoto || !documents.rcPhoto) {
      return t("app.wizardDocumentsRequired");
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
    if (step >= WIZARD_STEPS - 1) {
      void save();
      return;
    }
    setStep((current) => Math.min(WIZARD_STEPS - 1, current + 1));
  }

  function goBack() {
    setError(null);
    setStep((current) => Math.max(0, current - 1));
  }

  function closeForm() {
    if (saving || uploadingDoc) return;
    setFormOpen(false);
    setError(null);
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      // 1. Client-side compression to max 1280px at 0.82 JPEG quality
      const { dataUrl, blob } = await compressImageFile(file);

      // Immediately display preview in form so owner sees photo right away
      if (dataUrl) {
        setForm((current) => ({
          ...current,
          image: dataUrl,
          images: [dataUrl, ...current.images.filter((item) => item !== dataUrl)],
        }));
      }

      // 2. Upload the compressed blob to server
      try {
        const body = new FormData();
        body.append("file", blob, "tractor.jpg");
        const response = await fetch("/api/upload", { method: "POST", body });
        const result = (await response.json()) as { error?: string; url?: string };
        if (response.ok && result.url) {
          setForm((current) => ({
            ...current,
            image: result.url as string,
            images: [
              result.url as string,
              ...current.images.filter((item) => item !== result.url && item !== dataUrl),
            ],
          }));
        }
      } catch (uploadNetErr) {
        console.warn("Upload network error, retaining data URL:", uploadNetErr);
      }
      push(t("app.photoUploaded"), "success");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t("app.couldNotUploadPhoto"));
    } finally {
      setUploading(false);
    }
  }

  async function uploadDocument(kind: "dl" | "rc", file: File) {
    setUploadingDoc(kind);
    setError(null);
    try {
      const { blob } = await compressImageFile(file, 1600, 0.85);
      const body = new FormData();
      body.append("file", blob, `${kind}-document.jpg`);
      body.append("purpose", "document");
      const response = await fetch("/api/upload", { method: "POST", body });
      const result = (await response.json()) as { error?: string; url?: string };
      if (!response.ok || !result.url) {
        throw new Error(result.error ?? t("app.uploadFailed"));
      }
      setDocuments((current) => ({
        ...current,
        ...(kind === "dl" ? { dlPhoto: result.url as string } : { rcPhoto: result.url as string }),
      }));
      push(kind === "dl" ? t("app.dlUploaded") : t("app.rcUploaded"), "success");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : t("app.uploadFailed"),
      );
    } finally {
      setUploadingDoc(null);
    }
  }

  function removeDocument(kind: "dl" | "rc") {
    setDocuments((current) => ({
      ...current,
      ...(kind === "dl" ? { dlPhoto: "" } : { rcPhoto: "" }),
    }));
    if (kind === "dl" && dlRef.current) dlRef.current.value = "";
    if (kind === "rc" && rcRef.current) rcRef.current.value = "";
  }

  async function save() {
    for (let index = 0; index < WIZARD_STEPS; index += 1) {
      const message = validateStep(index);
      if (message) {
        setStep(index);
        setError(message);
        return;
      }
    }

    setError(null);
    const brand = form.brand.trim() || "Mahindra";
    const model = form.model.trim() || "575 DI";
    const equipmentIds = form.equipmentIds.length ? form.equipmentIds : ["eq_plough"];
    const village = form.village.trim();

    setSaving(true);
    try {
      const matchedVillage = VILLAGES.find(
        (item) => item.name.toLowerCase() === village.toLowerCase(),
      );
      const district =
        formDistrict || matchedVillage?.district || user.ownerProfile?.district || "";
      const state = formState || matchedVillage?.state || user.ownerProfile?.state || "";
      let lat = formCoords.lat;
      let lng = formCoords.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
        lat = matchedVillage?.lat ?? profileCoords(user).lat;
        lng = matchedVillage?.lng ?? profileCoords(user).lng;
      }
      const rcNumber = (
        documents.rcNumber || form.registrationNumber
      ).trim().toUpperCase();
      const payload = {
        brand,
        model,
        registrationNumber: form.registrationNumber.trim().toUpperCase(),
        horsepower: Number(form.horsepower) || 50,
        manufacturingYear: Number(form.manufacturingYear) || new Date().getFullYear(),
        image: form.image || undefined,
        images: form.images.length ? form.images : form.image ? [form.image] : undefined,
        status: form.status,
        village,
        address: formAddress.trim() || undefined,
        pincode: formPincode.trim() || undefined,
        district,
        state,
        lat,
        lng,
        serviceRadiusKm: Number(form.serviceRadiusKm) || 10,
        equipmentIds,
        hourlyEnabled: form.hourlyEnabled,
        hourlyRate: form.hourlyEnabled ? (Number(form.hourlyRate) || 800) : 0,
        acreEnabled: form.acreEnabled,
        acreRate: form.acreEnabled ? (Number(form.acreRate) || 1200) : 0,
        tripEnabled: form.tripEnabled,
        tripRate: form.tripEnabled ? (Number(form.tripRate) || 1500) : 0,
        documents: {
          dlPhoto: documents.dlPhoto || null,
          rcPhoto: documents.rcPhoto || null,
          rcNumber: /^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4}$/.test(rcNumber)
            ? rcNumber
            : null,
        },
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
      push(editing ? t("app.tractorUpdated") : t("app.wizardSaved"), "success");
      setFormOpen(false);
      setForm(emptyForm(user));
      setDocuments(emptyDocuments);
      setStep(0);
      setError(null);
      const isOnboarding =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("onboarding") === "1";
      if (isOnboarding) {
        router.push("/dashboard");
      }
      router.refresh();
    } catch (saveError) {
      const msg = saveError instanceof Error ? saveError.message : t("app.couldNotSaveTractor");
      setError(msg);
      push(msg, "error");
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

  const stepLabels = [
    t("app.wizardPhotoDetails"),
    t("app.wizardSpecs"),
    t("app.wizardLocationStep"),
    t("app.wizardDocumentsStep"),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="green" dot>{t("app.ownerTag")}</Badge>
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-stone/70">
              {[user.ownerProfile?.village, user.ownerProfile?.district]
                .filter(Boolean)
                .join(" · ")}
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
                  <MapPin className="size-3" />{" "}
                  {[tractor.village, tractor.district].filter(Boolean).join(", ")} ·{" "}
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
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              onClick={step === 0 ? closeForm : goBack}
              disabled={saving || Boolean(uploadingDoc)}
            >
              {step === 0 ? (
                t("common.cancel")
              ) : (
                <>
                  <ArrowLeft className="size-4" /> {t("app.wizardBack")}
                </>
              )}
            </Button>
            <Button
              onClick={goNext}
              loading={saving}
              disabled={uploading || Boolean(uploadingDoc)}
            >
              {step >= WIZARD_STEPS - 1 ? (
                <>
                  <Check className="size-4" /> {t("app.wizardSaveOpen")}
                </>
              ) : (
                <>
                  {t("app.wizardNext")} <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div>
            <div className="flex items-center gap-1.5">
              {stepLabels.map((label, index) => {
                const complete = index < step;
                const active = index === step;
                return (
                  <div key={label} className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.62rem] font-bold transition",
                        complete
                          ? "border-forest bg-forest text-cream"
                          : active
                            ? "border-forest bg-paper text-forest"
                            : "border-line bg-paper text-stone/70",
                      )}
                    >
                      {complete ? <Check className="size-3" /> : index + 1}
                    </span>
                    <span
                      className={cn(
                        "hidden truncate text-[0.62rem] font-semibold sm:block",
                        active ? "text-forest" : "text-stone",
                      )}
                    >
                      {label}
                    </span>
                    {index < stepLabels.length - 1 ? (
                      <span
                        className={cn(
                          "h-px min-w-2 flex-1",
                          complete ? "bg-forest/40" : "bg-line",
                        )}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-stone">
              {t("app.wizardStepOf", { current: step + 1, total: WIZARD_STEPS })}
            </p>
          </div>

          {step === 0 ? (
            <div className="space-y-4">
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
                    <Select
                      value={form.brand}
                      onChange={(event) => {
                        const newBrand = event.target.value;
                        const models = TRACTOR_BRANDS_AND_MODELS[newBrand] ?? [];
                        setForm((current) => ({
                          ...current,
                          brand: newBrand,
                          model: models[0] ?? current.model,
                        }));
                      }}
                    >
                      <option value="" disabled>-- {t("app.brand")} --</option>
                      {TRACTOR_BRANDS.map((brand) => (
                        <option key={brand} value={brand}>
                          {brand}
                        </option>
                      ))}
                      {form.brand && !TRACTOR_BRANDS.includes(form.brand) ? (
                        <option value={form.brand}>{form.brand}</option>
                      ) : null}
                    </Select>
                  </Field>
                  <Field label={t("app.model")} required>
                    <Select
                      value={form.model}
                      onChange={(event) => update("model", event.target.value)}
                    >
                      <option value="" disabled>-- {t("app.model")} --</option>
                      {availableModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                      {form.model && !availableModels.includes(form.model) ? (
                        <option value={form.model}>{form.model}</option>
                      ) : null}
                    </Select>
                  </Field>
                  <Field label={t("app.registration")} required className="sm:col-span-2">
                    <Input
                      value={form.registrationNumber}
                      onChange={(event) =>
                        update("registrationNumber", event.target.value.toUpperCase())
                      }
                      placeholder="MH 15 GT 4821"
                      autoComplete="off"
                    />
                  </Field>
                </div>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-forest">{t("app.wizardSpecs")}</h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <Field label={t("app.purchaseYear")} required>
                    <Input
                      type="number"
                      min="1970"
                      max={new Date().getFullYear() + 1}
                      value={form.manufacturingYear}
                      onChange={(event) => update("manufacturingYear", event.target.value)}
                    />
                  </Field>
                  <Field label={t("app.horsepower")} required hint="15–200 HP">
                    <Input
                      type="number"
                      min="15"
                      max="200"
                      value={form.horsepower}
                      onChange={(event) => update("horsepower", event.target.value)}
                    />
                  </Field>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-forest">{t("app.attachments")}</h3>
                <p className="mt-0.5 text-[0.68rem] text-stone">
                  {t("app.attachmentsHint")}
                </p>
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
                            {equipmentLabel(equipment.id, equipment.name)}
                          </span>
                          <span className="mt-0.5 block text-[0.64rem] leading-relaxed text-stone">
                            {equipmentDescription(equipment.id, equipment.description)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-forest">{t("app.ratesOptional")}</h3>
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
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-forest">{t("app.wizardLocationStep")}</h3>
                <p className="mt-0.5 text-[0.68rem] text-stone">{t("app.tractorLocationHint")}</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <Field label={t("app.village")} required hint={t("app.tractorVillageHint")}>
                    <Input
                      value={form.village}
                      onChange={(event) => changeVillageSelection(event.target.value)}
                      placeholder={t("app.villagePlaceholder")}
                      autoComplete="address-level2"
                    />
                  </Field>
                  <Field label={t("app.pincode")} hint="6-digit PIN">
                    <Input
                      value={formPincode}
                      onChange={(event) =>
                        setFormPincode(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="e.g. 560060"
                      maxLength={6}
                      inputMode="numeric"
                    />
                  </Field>
                  <Field label={t("app.address")} className="sm:col-span-2">
                    <Input
                      value={formAddress}
                      onChange={(event) => setFormAddress(event.target.value)}
                      placeholder={t("app.addressPlaceholder")}
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
                </div>
              </div>

              <div className="rounded-2xl border border-line/80 bg-cream/30 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-forest">
                      <MapPin className="size-3.5" /> {t("app.tractorLocation")}
                    </p>
                    <p className="mt-0.5 text-[0.65rem] leading-relaxed text-stone">
                      {t("app.locationManualHint")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={useFormLocation}
                    loading={locating}
                  >
                    <LocateFixed className="size-3.5" />
                    {locating ? t("app.locationDetecting") : t("app.useCurrentLocation")}
                  </Button>
                </div>
                <p className="mt-2 text-[0.6rem] text-stone">
                  {formCoords.lat.toFixed(4)}, {formCoords.lng.toFixed(4)}
                  {formDistrict || formState
                    ? ` · ${[formDistrict, formState].filter(Boolean).join(", ")}`
                    : ""}
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
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-forest">
                  <ShieldCheck className="size-4" /> {t("app.wizardDocumentsStep")}
                </h3>
                <p className="mt-0.5 text-[0.68rem] leading-relaxed text-stone">
                  {t("app.wizardDocsHint")}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-line bg-paper p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-forest">
                      <IdCard className="size-3.5" /> {t("app.drivingLicence")}
                    </p>
                    <Badge tone={documents.dlPhoto ? "green" : "stone"}>
                      {documents.dlPhoto ? t("app.verified") : t("common.required")}
                    </Badge>
                  </div>
                  {documents.dlPhoto ? (
                    <Photo
                      src={documents.dlPhoto}
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
                    ref={dlRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadDocument("dl", file);
                      event.target.value = "";
                    }}
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={uploadingDoc === "dl"}
                      disabled={uploadingDoc !== null}
                      onClick={() => dlRef.current?.click()}
                    >
                      <Upload className="size-3.5" />
                      {documents.dlPhoto ? t("app.replaceDl") : t("app.uploadDl")}
                    </Button>
                    {documents.dlPhoto ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={uploadingDoc !== null}
                        onClick={() => removeDocument("dl")}
                      >
                        <Trash2 className="size-3.5" /> {t("common.remove")}
                      </Button>
                    ) : null}
                  </div>
                  {documents.dlPhoto ? (
                    <p className="mt-1.5 text-[0.6rem] font-semibold text-forest">
                      {t("app.wizardDocsUploaded")}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-xl border border-line bg-paper p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-forest">
                      <FileCheck className="size-3.5" /> {t("app.vehicleRc")}
                    </p>
                    <Badge tone={documents.rcPhoto ? "green" : "stone"}>
                      {documents.rcPhoto ? t("app.verified") : t("common.required")}
                    </Badge>
                  </div>
                  <Field label={t("app.rcNumber")} className="mt-2" hint={t("app.rcHint")}>
                    <Input
                      value={documents.rcNumber || form.registrationNumber}
                      onChange={(event) =>
                        setDocuments((current) => ({
                          ...current,
                          rcNumber: event.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="MH 15 AB 1234"
                      autoComplete="off"
                    />
                  </Field>
                  {documents.rcPhoto ? (
                    <Photo
                      src={documents.rcPhoto}
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
                    ref={rcRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadDocument("rc", file);
                      event.target.value = "";
                    }}
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={uploadingDoc === "rc"}
                      disabled={uploadingDoc !== null}
                      onClick={() => rcRef.current?.click()}
                    >
                      <Upload className="size-3.5" />
                      {documents.rcPhoto ? t("app.replaceRcPhoto") : t("app.uploadRcPhoto")}
                    </Button>
                    {documents.rcPhoto ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={uploadingDoc !== null}
                        onClick={() => removeDocument("rc")}
                      >
                        <Trash2 className="size-3.5" /> {t("common.remove")}
                      </Button>
                    ) : null}
                  </div>
                  {documents.rcPhoto ? (
                    <p className="mt-1.5 text-[0.6rem] font-semibold text-forest">
                      {t("app.wizardDocsUploaded")}
                    </p>
                  ) : null}
                </div>
              </div>

              <Alert tone="info">
                <span className="flex items-start gap-1.5">
                  <ShieldCheck className="mt-0.5 size-3 shrink-0" />
                  {t("app.verifiedExplanation")}
                </span>
              </Alert>
            </div>
          ) : null}
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
              {t("app.removeTractor")}
            </Button>
          </>
        }
      />
    </div>
  );
}
