"use client";

import { useRef, useState } from "react";
import {
  BadgeCheck,
  Check,
  ImagePlus,
  Landmark,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  Upload,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Photo } from "@/components/ui/photo";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  Toggle,
  buttonStyles,
} from "@/components/ui/primitives";
import { useToast } from "@/components/providers/app-providers";
import { PAYMENT_METHODS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import type { PaymentMethod, SessionUser } from "@/lib/types";

export function OwnerPaymentsScreen({ user }: { user: SessionUser }) {
  const { t } = useI18n();
  const { push } = useToast();
  const router = useRouter();
  const initial = user.ownerProfile?.payment;
  const [preferredMethod, setPreferredMethod] = useState<PaymentMethod>(
    initial?.preferredMethod ?? "upi",
  );
  const [shareUpi, setShareUpi] = useState(initial?.shareUpi ?? false);
  const [upiId, setUpiId] = useState(initial?.upiId ?? "");
  const [shareQr, setShareQr] = useState(initial?.shareQr ?? false);
  const [qrImage, setQrImage] = useState(initial?.qrImage ?? "");
  const [shareBank, setShareBank] = useState(initial?.shareBank ?? false);
  const [bankAccountName, setBankAccountName] = useState(initial?.bankAccountName ?? "");
  const [bankAccountNumber, setBankAccountNumber] = useState(initial?.bankAccountNumber ?? "");
  const [bankIfsc, setBankIfsc] = useState(initial?.bankIfsc ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadQr(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body });
      const result = (await response.json()) as { error?: string; url?: string };
      if (!response.ok || !result.url) throw new Error(result.error ?? "Could not upload the QR image.");
      setQrImage(result.url);
      setShareQr(true);
      push("Payment QR uploaded.", "success");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload the QR image.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/owner/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredMethod,
          shareUpi,
          upiId,
          shareQr,
          qrImage,
          shareBank,
          bankAccountName,
          bankAccountNumber,
          bankIfsc,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not save payment details.");
      setSaved(true);
      push("Payment details saved.", "success");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save payment details.");
    } finally {
      setSaving(false);
    }
  }

  const activeMethod = PAYMENT_METHODS.find((item) => item.id === preferredMethod);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <Badge tone="green" dot>{t("app.ownerTag")}</Badge>
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-stone/70">
            Direct payments
          </span>
        </div>
        <h1 className="mt-2 font-display text-3xl text-forest sm:text-[2.4rem]">
          {t("app.ownerPaymentsTitle")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-stone">{t("app.ownerPaymentSettingsSub")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr] lg:items-start">
        <Card className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Payment preferences</p>
              <h2 className="mt-1.5 font-display text-2xl text-forest">
                {t("app.paymentDetailsTitle")}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-stone">
                These details are shown only to a farmer who has a booking with you. Everything is
                optional. Farmers can always pay cash or ask you directly.
              </p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-forest/8 text-forest">
              <Wallet className="size-5" />
            </span>
          </div>

          {error ? (
            <Alert tone="danger" className="mt-4">
              {error}
            </Alert>
          ) : null}
          {saved ? (
            <Alert tone="success" className="mt-4">
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5" /> Payment details saved. Farmers with an accepted
                booking can now see the options you shared.
              </span>
            </Alert>
          ) : null}

          <div className="mt-5">
            <Field
              label={t("app.preferredMethod")}
              hint="Shown as a suggestion to the farmer"
            >
              <Select
                value={preferredMethod}
                onChange={(event) => setPreferredMethod(event.target.value as PaymentMethod)}
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.label} — {method.description}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-line/80 bg-cream/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-forest/8 text-forest">
                    <Smartphone className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-forest">{t("app.shareUpi")}</p>
                    <p className="mt-0.5 text-[0.65rem] leading-relaxed text-stone">
                      A farmer can copy your UPI ID and pay from their own UPI app.
                    </p>
                  </div>
                </div>
                <Toggle checked={shareUpi} onChange={setShareUpi} label="" />
              </div>
              {shareUpi ? (
                <div className="mt-3">
                  <Field label={t("app.upiId")} required>
                    <Input
                      value={upiId}
                      onChange={(event) => setUpiId(event.target.value)}
                      placeholder="ramesh.shinde@upi"
                      autoComplete="off"
                    />
                  </Field>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-line/80 bg-cream/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-forest/8 text-forest">
                    <ImagePlus className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-forest">{t("app.shareQr")}</p>
                    <p className="mt-0.5 text-[0.65rem] leading-relaxed text-stone">
                      Upload a screenshot of your own payment QR. Do not upload a QR that asks for a
                      PIN or password.
                    </p>
                  </div>
                </div>
                <Toggle checked={shareQr} onChange={setShareQr} label="" />
              </div>
              {shareQr ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Photo
                    src={qrImage}
                    alt="Payment QR"
                    className="h-28 w-28 shrink-0 rounded-xl border border-line"
                    sizes="112px"
                  />
                  <div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadQr(file);
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
                      {uploading ? "Uploading…" : qrImage ? "Replace QR" : "Upload QR"}
                    </button>
                    {qrImage ? (
                      <button
                        type="button"
                        onClick={() => setQrImage("")}
                        className="ml-2 text-[0.65rem] font-semibold text-clay hover:underline"
                      >
                        Remove
                      </button>
                    ) : null}
                    <p className="mt-2 text-[0.6rem] text-stone">PNG, JPG or WebP · up to 5 MB.</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-line/80 bg-cream/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-forest/8 text-forest">
                    <Landmark className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-forest">{t("app.shareBank")}</p>
                    <p className="mt-0.5 text-[0.65rem] leading-relaxed text-stone">
                      Optional bank details for a direct transfer. KisanTractor never asks for a bank
                      OTP, UPI PIN or password.
                    </p>
                  </div>
                </div>
                <Toggle checked={shareBank} onChange={setShareBank} label="" />
              </div>
              {shareBank ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Account holder name" required className="sm:col-span-2">
                    <Input
                      value={bankAccountName}
                      onChange={(event) => setBankAccountName(event.target.value)}
                      placeholder="Ramesh Shinde"
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Account number" required>
                    <Input
                      value={bankAccountNumber}
                      onChange={(event) =>
                        setBankAccountNumber(event.target.value.replace(/[^\d\s]/g, ""))
                      }
                      placeholder="1234 5678 9012"
                      inputMode="numeric"
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="IFSC code" required>
                    <Input
                      value={bankIfsc}
                      onChange={(event) => setBankIfsc(event.target.value.toUpperCase())}
                      placeholder="SBIN0001234"
                      maxLength={11}
                      autoComplete="off"
                    />
                  </Field>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line/80 pt-4">
            <p className="text-[0.65rem] text-stone">
              Changes apply to bookings immediately. Existing payment records are not changed.
            </p>
            <Button onClick={save} loading={saving}>
              <Check className="size-4" /> {t("common.save")}
            </Button>
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="overflow-hidden">
            <div className="bg-forest px-4 py-4 text-cream">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-wheat/80">
                Your current setting
              </p>
              <p className="mt-1 font-display text-2xl text-cream">
                {activeMethod?.label ?? "Direct payment"}
              </p>
              <p className="mt-1 text-[0.65rem] leading-relaxed text-cream/55">
                {activeMethod?.description ?? "Agreed directly with the farmer."}
              </p>
            </div>
            <div className="space-y-2 p-4 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-stone">UPI</span>
                <span className="font-semibold text-forest">
                  {shareUpi && upiId ? "Shared" : "Not shared"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-stone">Payment QR</span>
                <span className="font-semibold text-forest">
                  {shareQr && qrImage ? "Shared" : "Not shared"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-stone">Bank transfer</span>
                <span className="font-semibold text-forest">
                  {shareBank && bankAccountNumber ? "Shared" : "Not shared"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-line/70 pt-2">
                <span className="text-stone">Cash</span>
                <span className="font-semibold text-forest">Always accepted</span>
              </div>
            </div>
          </Card>

          <Alert tone="warning" title="Never share secrets">
            <span className="flex items-start gap-2">
              <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
              <span>{t("app.paymentSafetyOwner")}</span>
            </span>
          </Alert>

          <div className="rounded-2xl border border-line/70 bg-paper/60 p-4">
            <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-stone">
              <ShieldCheck className="size-3.5" /> How confirmation works
            </p>
            <ol className="mt-2 space-y-2 text-[0.66rem] leading-relaxed text-stone">
              <li className="flex gap-2">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-forest/10 text-[0.55rem] font-bold text-forest">
                  1
                </span>
                The farmer pays you directly using UPI, cash, bank transfer or another agreed method.
              </li>
              <li className="flex gap-2">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-forest/10 text-[0.55rem] font-bold text-forest">
                  2
                </span>
                Check your own UPI app, bank account or cash to confirm the money has arrived.
              </li>
              <li className="flex gap-2">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-forest/10 text-[0.55rem] font-bold text-forest">
                  3
                </span>
                Open the booking and tap Mark payment done. The booking then shows Payment Received
                and is completed.
              </li>
            </ol>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-forest/10 bg-forest/5 px-3.5 py-3 text-[0.66rem] leading-relaxed text-forest/80">
            <BadgeCheck className="size-4 shrink-0" />
            <span>
              KisanTractor does not hold your money and takes no commission. Your recorded earnings
              reflect payments you have confirmed.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
