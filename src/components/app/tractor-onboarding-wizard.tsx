"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  CheckCircle2,
  FileCheck,
  IdCard,
  LocateFixed,
  MapPin,
  Tractor,
  Upload,
} from "lucide-react";
import { Photo } from "@/components/ui/photo";
import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  Select,
} from "@/components/ui/primitives";
import { useToast } from "@/components/providers/app-providers";
import {
  EQUIPMENT_CATALOG,
  TRACTOR_BRANDS,
  TRACTOR_BRANDS_AND_MODELS,
  VILLAGES,
} from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import type { SessionUser } from "@/lib/types";
import { cn, reverseGeocode } from "@/lib/utils";

export type WizardStep = "details" | "specs" | "location" | "documents";

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
            resolve({ dataUrl, blob: blob ?? file });
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

export function TractorOnboardingWizard({
  user,
  onCompleted,
  onCancel,
}: {
  user?: SessionUser | null;
  onCompleted?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { push } = useToast();

  const [currentStep, setCurrentStep] = useState<WizardStep>("details");

  // Step 2: Tractor Details Entry
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [brand, setBrand] = useState<string>("Mahindra");
  const [model, setModel] = useState<string>("575 DI");
  const [registrationNumber, setRegistrationNumber] = useState<string>("");

  // Step 3: Tractor Specifications
  const currentYear = new Date().getFullYear();
  const [purchaseYear, setPurchaseYear] = useState<number>(currentYear - 2);
  const [horsepower, setHorsepower] = useState<number>(50);
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([
    "eq_plough",
    "eq_rotavator",
  ]);

  // Step 4: Location Entry
  const profileVillage = user?.ownerProfile?.village?.trim() ?? "";
  const [locationName, setLocationName] = useState<string>(profileVillage);
  const [locationAddress, setLocationAddress] = useState<string>(
    user?.ownerProfile?.address ?? "",
  );
  const [pincode, setPincode] = useState<string>(
    user?.ownerProfile?.pincode ?? "",
  );
  const [coords, setCoords] = useState(() => ({
    lat: user?.ownerProfile?.lat ?? 0,
    lng: user?.ownerProfile?.lng ?? 0,
  }));
  const [detectedDistrict, setDetectedDistrict] = useState<string>(
    user?.ownerProfile?.district ?? "",
  );
  const [detectedState, setDetectedState] = useState<string>(
    user?.ownerProfile?.state ?? "",
  );
  const [serviceRadiusKm, setServiceRadiusKm] = useState<number>(
    user?.ownerProfile?.serviceRadiusKm ?? 15,
  );
  const [locating, setLocating] = useState<boolean>(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  // Step 5: Document Upload & Verification
  const [dlPhoto, setDlPhoto] = useState<string>(
    user?.ownerProfile?.documents?.dlPhoto ?? "",
  );
  const [rcPhoto, setRcPhoto] = useState<string>(
    user?.ownerProfile?.documents?.rcPhoto ?? "",
  );
  const [uploadingKind, setUploadingKind] = useState<"tractor" | "dl" | "rc" | null>(
    null,
  );

  // General state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dlInputRef = useRef<HTMLInputElement>(null);
  const rcInputRef = useRef<HTMLInputElement>(null);

  const availableModels = useMemo(() => {
    if (brand && TRACTOR_BRANDS_AND_MODELS[brand]) {
      return TRACTOR_BRANDS_AND_MODELS[brand];
    }
    return TRACTOR_BRANDS_AND_MODELS["Mahindra"] ?? [];
  }, [brand]);

  // Photo upload handler
  async function handlePhotoUpload(
    file: File,
    kind: "tractor" | "dl" | "rc",
  ) {
    setUploadingKind(kind);
    setError(null);
    try {
      const { dataUrl, blob } = await compressImageFile(file);

      if (kind === "tractor") {
        if (dataUrl) setPhotoUrl(dataUrl);
      } else if (kind === "dl") {
        if (dataUrl) setDlPhoto(dataUrl);
      } else if (kind === "rc") {
        if (dataUrl) setRcPhoto(dataUrl);
      }

      // Upload to server endpoint
      const body = new FormData();
      body.append("file", blob, `${kind}.jpg`);
      body.append("purpose", kind === "tractor" ? "photo" : "document");
      const res = await fetch("/api/upload", { method: "POST", body });
      const result = (await res.json()) as { url?: string; error?: string };
      if (res.ok && result.url) {
        if (kind === "tractor") setPhotoUrl(result.url);
        else if (kind === "dl") setDlPhoto(result.url);
        else if (kind === "rc") setRcPhoto(result.url);
      }
      push(t("app.photoUploaded"), "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("app.couldNotUploadPhoto"));
    } finally {
      setUploadingKind(null);
    }
  }

  // Location Auto-Detect
  function autoDetectLocation() {
    setError(null);
    setLocationNote(null);
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError(t("app.locationNeedsHttps"));
      return;
    }
    if (!navigator.geolocation) {
      setError(t("app.locationBrowserUnsupported"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Math.round(pos.coords.latitude * 100000) / 100000;
        const lng = Math.round(pos.coords.longitude * 100000) / 100000;
        setCoords({ lat, lng });

        try {
          const geo = await reverseGeocode(lat, lng);
          const detected =
            geo.village ||
            geo.district ||
            (geo.address ? geo.address.split(",")[0].trim() : "");
          if (detected) setLocationName(detected);
          if (geo.address) setLocationAddress(geo.address);
          if (geo.pincode) setPincode(geo.pincode);
          if (geo.district) setDetectedDistrict(geo.district);
          if (geo.state) setDetectedState(geo.state);
          const summary = [detected, geo.district, geo.state]
            .filter(Boolean)
            .join(", ");
          setLocationNote(
            summary
              ? `${summary}${geo.pincode ? ` (${geo.pincode})` : ""}`
              : `${lat}, ${lng}`,
          );
          push(t("app.tractorLocationDetected"), "success");
        } catch {
          setLocationNote(`${lat}, ${lng}`);
          push(t("app.tractorLocationDetected"), "success");
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? t("app.locationPermissionBlocked")
            : t("app.locationUnavailable"),
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }

  function toggleAttachment(id: string) {
    setSelectedAttachments((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  // Validation before advancing
  function validateDetails(): boolean {
    if (!brand.trim()) {
      setError("Please select or enter the tractor brand.");
      return false;
    }
    if (!model.trim()) {
      setError("Please select or enter the tractor model.");
      return false;
    }
    if (!registrationNumber.trim()) {
      setError("Please enter the tractor's registration number (e.g. MH 15 GT 4821).");
      return false;
    }
    setError(null);
    return true;
  }

  function validateSpecs(): boolean {
    if (horsepower < 15 || horsepower > 200) {
      setError("Please enter a valid horsepower between 15 and 200 HP.");
      return false;
    }
    if (selectedAttachments.length === 0) {
      setError("Please select at least one attachment (e.g. Plough, Rotavator, Trailer).");
      return false;
    }
    setError(null);
    return true;
  }

  function validateLocation(): boolean {
    if (!locationName.trim()) {
      setError("Please enter or auto-detect the tractor's location.");
      return false;
    }
    setError(null);
    return true;
  }

  // Final Step: Save Tractor and Documents
  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const matchedVillage = VILLAGES.find(
        (v) => v.name.toLowerCase() === locationName.trim().toLowerCase(),
      );
      const district =
        detectedDistrict || matchedVillage?.district || "";
      const state = detectedState || matchedVillage?.state || "";
      let lat = coords.lat;
      let lng = coords.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
        if (matchedVillage) {
          lat = matchedVillage.lat;
          lng = matchedVillage.lng;
        }
      }

      const payload = {
        brand: brand.trim(),
        model: model.trim(),
        registrationNumber: registrationNumber.trim().toUpperCase(),
        horsepower: Number(horsepower) || 50,
        manufacturingYear: Number(purchaseYear) || currentYear,
        image: photoUrl || undefined,
        images: photoUrl ? [photoUrl] : undefined,
        status: "active" as const,
        village: locationName.trim(),
        address: locationAddress.trim() || undefined,
        pincode: pincode.trim() || undefined,
        district,
        state,
        lat,
        lng,
        serviceRadiusKm: Number(serviceRadiusKm) || 15,
        equipmentIds: selectedAttachments.length ? selectedAttachments : ["eq_plough"],
        hourlyEnabled: true,
        hourlyRate: 800,
        acreEnabled: true,
        acreRate: 1200,
        tripEnabled: true,
        tripRate: 1500,
        documents: {
          dlPhoto: dlPhoto || null,
          rcPhoto: rcPhoto || null,
          rcNumber: registrationNumber.trim().toUpperCase() || null,
        },
      };

      const res = await fetch("/api/tractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not save tractor details. Please try again.");
      }

      // Also ensure owner profile location & documents are recorded
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          village: locationName.trim(),
          address: locationAddress.trim() || undefined,
          pincode: pincode.trim() || undefined,
          district,
          state,
          lat,
          lng,
          serviceRadiusKm: Number(serviceRadiusKm) || 15,
          documents: {
            dlPhoto: dlPhoto || null,
            rcPhoto: rcPhoto || null,
            rcNumber: registrationNumber.trim().toUpperCase() || null,
          },
        }),
      }).catch(() => undefined);

      push("Tractor details saved successfully! Opening Owner Dashboard...", "success");

      if (onCompleted) {
        onCompleted();
      } else {
        // Step 7: Tractor Owner Dashboard opens
        router.push("/dashboard");
        router.refresh();
      }
    } catch (saveErr) {
      const msg = saveErr instanceof Error ? saveErr.message : "Could not save tractor details.";
      setError(msg);
      push(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  const stepsList: { key: WizardStep; number: number; label: string }[] = [
    { key: "details", number: 2, label: "Tractor Details" },
    { key: "specs", number: 3, label: "Specifications" },
    { key: "location", number: 4, label: "Location" },
    { key: "documents", number: 5, label: "Documents & Save" },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl rounded-3xl border border-line bg-paper p-5 shadow-2xl sm:p-8">
      {/* Top Stepper Header */}
      <div className="border-b border-line/80 pb-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-forest text-cream">
              <Tractor className="size-5" />
            </span>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-forest">
                Tractor Owner Registration
              </p>
              <h2 className="font-display text-xl text-forest sm:text-2xl">
                {currentStep === "details" && "2. Tractor Details Entry"}
                {currentStep === "specs" && "3. Tractor Specifications"}
                {currentStep === "location" && "4. Location Entry"}
                {currentStep === "documents" && "5. Document Upload & Verification"}
              </h2>
            </div>
          </div>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full px-3 py-1.5 text-xs text-stone hover:bg-sand"
            >
              Cancel
            </button>
          ) : null}
        </div>

        {/* Step indicator pills */}
        <div className="mt-4 grid grid-cols-4 gap-1.5 sm:gap-2">
          {stepsList.map((st) => {
            const stepOrder = ["details", "specs", "location", "documents"];
            const currentIdx = stepOrder.indexOf(currentStep);
            const thisIdx = stepOrder.indexOf(st.key);
            const isDone = thisIdx < currentIdx;
            const isCurrent = thisIdx === currentIdx;
            return (
              <div
                key={st.key}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.62rem] font-semibold transition sm:text-xs",
                  isCurrent && "bg-forest text-cream",
                  isDone && "bg-forest/15 text-forest",
                  !isCurrent && !isDone && "bg-sand text-stone",
                )}
              >
                <span className="shrink-0">{isDone ? "✓" : st.number}</span>
                <span className="truncate">{st.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {error ? (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      ) : null}

      {/* Step 2: Tractor Details Entry */}
      {currentStep === "details" && (
        <div className="mt-5 space-y-5">
          {/* Tractor Photo Upload */}
          <div>
            <label className="text-xs font-semibold text-forest">
              Upload Tractor Photo
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-cream/40 p-4">
              <Photo
                src={photoUrl}
                alt="Tractor Photo"
                className="size-24 shrink-0 rounded-2xl border border-line shadow-sm sm:size-28"
                sizes="120px"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs font-semibold text-forest">
                  Tractor Front / Side Photo
                </p>
                <p className="text-[0.68rem] leading-relaxed text-stone">
                  Clear photo helps farmers quickly recognize and book your tractor. Camera photos are automatically optimized.
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handlePhotoUpload(file, "tractor");
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handlePhotoUpload(file, "tractor");
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={uploadingKind === "tractor"}
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="size-3.5" /> Take Photo
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={uploadingKind === "tractor"}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-3.5" /> Upload File
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Brand & Model Dropdowns */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tractor Brand Name" required>
              <Select
                value={brand}
                onChange={(e) => {
                  const newBrand = e.target.value;
                  const models = TRACTOR_BRANDS_AND_MODELS[newBrand] ?? [];
                  setBrand(newBrand);
                  setModel(models[0] ?? "DI");
                }}
              >
                <option value="" disabled>-- Select Brand --</option>
                {TRACTOR_BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
                {brand && !TRACTOR_BRANDS.includes(brand) ? (
                  <option value={brand}>{brand}</option>
                ) : null}
              </Select>
            </Field>

            <Field label="Tractor Model" required>
              <Select
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="" disabled>-- Select Model --</option>
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                {model && !availableModels.includes(model) ? (
                  <option value={model}>{model}</option>
                ) : null}
              </Select>
            </Field>
          </div>

          {/* Registration Number */}
          <Field
            label="Registration Number"
            hint="e.g. MH 15 GT 4821 or KA 05 TR 1234"
            required
          >
            <Input
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
              placeholder="MH 15 AB 1234"
              className="font-mono font-semibold uppercase tracking-wider"
            />
          </Field>

          {/* Footer Navigation */}
          <div className="flex justify-end pt-3">
            <Button
              type="button"
              onClick={() => {
                if (validateDetails()) setCurrentStep("specs");
              }}
            >
              <span>Next: Specifications</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Tractor Specifications */}
      {currentStep === "specs" && (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Purchase Year */}
            <Field label="Purchase Year" hint="Manufacturing / Purchase Year" required>
              <Select
                value={String(purchaseYear)}
                onChange={(e) => setPurchaseYear(Number(e.target.value))}
              >
                {Array.from({ length: 35 }, (_, i) => currentYear - i).map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Horsepower */}
            <Field label="Horsepower (HP)" hint="Engine power in HP" required>
              <Input
                type="number"
                min="15"
                max="200"
                value={horsepower}
                onChange={(e) => setHorsepower(Number(e.target.value))}
                placeholder="50"
              />
            </Field>
          </div>

          {/* Quick HP Selection Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.68rem] text-stone">Popular HP:</span>
            {[35, 40, 45, 50, 55, 60, 75].map((hp) => (
              <button
                key={hp}
                type="button"
                onClick={() => setHorsepower(hp)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-semibold transition",
                  horsepower === hp
                    ? "border-forest bg-forest text-cream"
                    : "border-line bg-sand/40 text-ink hover:bg-sand",
                )}
              >
                {hp} HP
              </button>
            ))}
          </div>

          {/* Attachments (Plough, Rotavator, Trailer, etc.) */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-forest">
                Available Attachments <span className="text-clay">*</span>
              </label>
              <span className="text-[0.65rem] text-stone">
                Select all tools you provide with your tractor
              </span>
            </div>

            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {EQUIPMENT_CATALOG.map((eq) => {
                const isChecked = selectedAttachments.includes(eq.id);
                return (
                  <button
                    key={eq.id}
                    type="button"
                    onClick={() => toggleAttachment(eq.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl border p-3 text-left transition",
                      isChecked
                        ? "border-forest bg-forest/7 ring-1 ring-forest/30"
                        : "border-line bg-sand/20 hover:bg-sand/50",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-lg border text-xs transition",
                        isChecked
                          ? "border-forest bg-forest text-cream"
                          : "border-line bg-paper text-transparent",
                      )}
                    >
                      <Check className="size-3 stroke-3" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-forest">{eq.name}</p>
                      <p className="text-[0.68rem] text-stone">{eq.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="flex items-center justify-between border-t border-line/70 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep("details")}
            >
              <ArrowLeft className="size-4" /> Back
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (validateSpecs()) setCurrentStep("location");
              }}
            >
              <span>Next: Location</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Location Entry */}
      {currentStep === "location" && (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tractor Current Village / Town" hint="Village / Town name" required>
              <Input
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Enter your village or town name"
                autoComplete="address-level2"
              />
            </Field>

            <Field label="PIN Code" hint="6-digit postal code">
              <Input
                value={pincode}
                onChange={(e) =>
                  setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="e.g. 560060"
                maxLength={6}
                inputMode="numeric"
              />
            </Field>
          </div>

          <Field label="Full Farm / House Address" hint="Door no, street, landmark, area">
            <Input
              value={locationAddress}
              onChange={(e) => setLocationAddress(e.target.value)}
              placeholder="e.g. Near Panchayat Office, Main Road"
              autoComplete="street-address"
            />
          </Field>

          {/* Auto-detect Location with GPS */}
          <div className="rounded-2xl border border-line bg-cream/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-forest">
                  <MapPin className="size-4 text-forest" />
                  Auto-Detect GPS Location
                </p>
                <p className="mt-0.5 text-[0.68rem] text-stone">
                  Click to capture your live farm/village coordinates accurately.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={locating}
                onClick={autoDetectLocation}
              >
                <LocateFixed className="size-3.5" />
                {locating ? "Detecting..." : "Auto Detect Location"}
              </Button>
            </div>

            {locationNote ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-forest/10 px-3 py-2 text-xs font-medium text-forest">
                <CheckCircle2 className="size-4 shrink-0 text-forest" />
                <span>Detected: {locationNote}</span>
              </div>
            ) : (
              <p className="mt-2 text-[0.65rem] text-stone">
                Current coordinates: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </p>
            )}
          </div>

          {/* Service Radius */}
          <Field
            label="Service Radius (km)"
            hint="How far will you travel for farm bookings? (1–50 km)"
          >
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="1"
                max="50"
                value={serviceRadiusKm}
                onChange={(e) => setServiceRadiusKm(Number(e.target.value))}
                className="w-28"
              />
              <span className="text-xs font-semibold text-forest">km radius</span>
            </div>
          </Field>

          {/* Footer Navigation */}
          <div className="flex items-center justify-between border-t border-line/70 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep("specs")}
            >
              <ArrowLeft className="size-4" /> Back
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (validateLocation()) setCurrentStep("documents");
              }}
            >
              <span>Next: Documents & Save</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Document Upload & Verification */}
      {currentStep === "documents" && (
        <div className="mt-5 space-y-5">
          <div className="rounded-2xl border border-forest/15 bg-forest/4 p-3 text-xs text-forest">
            <div className="flex items-center gap-1.5 font-semibold">
              <BadgeCheck className="size-4 text-forest" />
              Document Upload & Verification
            </div>
            <p className="mt-0.5 text-[0.68rem] text-stone">
              Upload your Driving License and Tractor RC to earn the Verified badge and get 3x more bookings from farmers.
            </p>
          </div>

          {/* DL (Driving License) */}
          <div className="rounded-2xl border border-line bg-paper p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IdCard className="size-4 text-forest" />
                <span className="text-xs font-bold text-forest">
                  1. DL (Driving License)
                </span>
              </div>
              <Badge tone={dlPhoto ? "green" : "stone"} dot={Boolean(dlPhoto)}>
                {dlPhoto ? "Uploaded & Verified" : "Pending Upload"}
              </Badge>
            </div>

            {dlPhoto ? (
              <Photo
                src={dlPhoto}
                alt="Driving License"
                className="mt-3 h-28 w-full rounded-xl border border-line sm:h-32"
                sizes="(max-width: 640px) 100vw, 400px"
              />
            ) : null}

            <input
              ref={dlInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handlePhotoUpload(file, "dl");
                e.target.value = "";
              }}
            />

            <div className="mt-3 flex items-center gap-2">
              <Button
                type="button"
                variant={dlPhoto ? "outline" : "secondary"}
                size="sm"
                loading={uploadingKind === "dl"}
                onClick={() => dlInputRef.current?.click()}
              >
                <Upload className="size-3.5" />
                {dlPhoto ? "Change Driving License" : "Upload Driving License"}
              </Button>
            </div>
          </div>

          {/* RC (Registration Certificate) */}
          <div className="rounded-2xl border border-line bg-paper p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="size-4 text-forest" />
                <span className="text-xs font-bold text-forest">
                  2. RC (Registration Certificate)
                </span>
              </div>
              <Badge tone={rcPhoto ? "green" : "stone"} dot={Boolean(rcPhoto)}>
                {rcPhoto ? "Uploaded & Verified" : "Pending Upload"}
              </Badge>
            </div>

            {rcPhoto ? (
              <Photo
                src={rcPhoto}
                alt="Registration Certificate"
                className="mt-3 h-28 w-full rounded-xl border border-line sm:h-32"
                sizes="(max-width: 640px) 100vw, 400px"
              />
            ) : null}

            <input
              ref={rcInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handlePhotoUpload(file, "rc");
                e.target.value = "";
              }}
            />

            <div className="mt-3 flex items-center gap-2">
              <Button
                type="button"
                variant={rcPhoto ? "outline" : "secondary"}
                size="sm"
                loading={uploadingKind === "rc"}
                onClick={() => rcInputRef.current?.click()}
              >
                <Upload className="size-3.5" />
                {rcPhoto ? "Change RC Photo" : "Upload Tractor RC"}
              </Button>
            </div>
          </div>

          {/* Summary check before saving */}
          <div className="rounded-2xl border border-line bg-cream/30 p-3.5 text-xs text-stone">
            <p className="font-semibold text-forest">Ready to Save & Activate Tractor</p>
            <p className="mt-0.5 text-[0.68rem]">
              Tractor: <strong className="text-forest">{brand} {model}</strong> ({registrationNumber}) · {locationName}
            </p>
          </div>

          {/* Footer Navigation & Save */}
          <div className="flex items-center justify-between border-t border-line/70 pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setCurrentStep("location")}
            >
              <ArrowLeft className="size-4" /> Back
            </Button>
            <Button
              type="button"
              loading={saving}
              onClick={handleSave}
              className="btn-shine !bg-forest text-cream shadow-lg"
            >
              <Check className="size-4" />
              <span>Save & Open Dashboard</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
