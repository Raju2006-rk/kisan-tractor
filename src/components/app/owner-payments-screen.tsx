"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
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
import { OwnerEarningsCard } from "@/components/app/owner-earnings";
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
import type { OwnerEarningsSummary, PaymentMethod, SessionUser } from "@/lib/types";

export function OwnerPaymentsScreen({ user }: { user: SessionUser }) {
  const { t } = useI18n();
  const { push } = useToast();
  const router = useRouter();
  const { data: dashboardData } = useSWR<{
    dashboard: { earnings: OwnerEarningsSummary };
  }>("/api/owner/dashboard", { refreshInterval: 30000 });
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
      if (!response.ok || !result.url) throw new Error(result.error ?? t("app.couldNotUploadQr"));
      setQrImage(result.url);
      setShareQr(true);
      push(t("app.paymentQrUploaded"), "success");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t("app.couldNotUploadQr"));
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
      if (!response.ok) throw new Error(result.error ?? t("app.couldNotSavePayment"));
      setSaved(true);
      push(t("app.paymentDetailsSavedShort"), "success");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("app.couldNotSavePayment"));
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
            {t("app.directPayments")}
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
              <p className="eyebrow">{t("app.paymentPreferences")}</p>
              <h2 className="mt-1.5 font-display text-2xl text-forest">
                {t("app.paymentDetailsTitle")}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-stone">
                {t("app.paymentDetailsBody")}
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
                <Check className="size-3.5" /> {t("app.paymentDetailsSaved")}
              </span>
            </Alert>
          ) : null}

          <div className="mt-5">
            <Field
              label={t("app.preferredMethod")}
              hint={t("app.preferredMethodHint")}
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
                      {t("app.upiBody")}
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
                      {t("app.qrBody")}
                    </p>
                  </div>
                </div>
                <Toggle checked={shareQr} onChange={setShareQr} label="" />
              </div>
              {shareQr ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Photo
                    src={qrImage}
                    alt={t("app.paymentQrAlt")}
                    className="h-28 w-28 shrink-0 rounded-xl border border-line"
                    sizes="112px"
                  />
                  <div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
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
                      {uploading
                        ? t("common.uploading")
                        : qrImage
                          ? t("app.replaceQr")
                          : t("app.uploadQr")}
                    </button>
                    {qrImage ? (
                      <button
                        type="button"
                        onClick={() => setQrImage("")}
                        className="ml-2 text-[0.65rem] font-semibold text-clay hover:underline"
                      >
                        {t("common.remove")}
                      </button>
                    ) : null}
                    <p className="mt-2 text-[0.6rem] text-stone">{t("app.fileTypes")}</p>
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
                      {t("app.bankBody")}
                    </p>
                  </div>
                </div>
                <Toggle checked={shareBank} onChange={setShareBank} label="" />
              </div>
              {shareBank ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label={t("app.accountHolder")} required className="sm:col-span-2">
                    <Input
                      value={bankAccountName}
                      onChange={(event) => setBankAccountName(event.target.value)}
                      placeholder={t("app.accountHolderPlaceholder")}
                      autoComplete="off"
                    />
                  </Field>
                  <Field label={t("app.accountNumber")} required>
                    <Input
                      value={bankAccountNumber}
                      onChange={(event) =>
                        setBankAccountNumber(event.target.value.replace(/[^\d\s]/g, ""))
                      }
                      placeholder={t("app.accountNumberPlaceholder")}
                      inputMode="numeric"
                      autoComplete="off"
                    />
                  </Field>
                  <Field label={t("app.ifsc")} required>
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
              {t("app.changesApply")}
            </p>
            <Button onClick={save} loading={saving}>
              <Check className="size-4" /> {t("common.save")}
            </Button>
          </div>
        </Card>

        <div className="space-y-3">
          {dashboardData?.dashboard.earnings ? (
            <OwnerEarningsCard
              earnings={dashboardData.dashboard.earnings}
              compact
            />
          ) : null}

          <Card className="overflow-hidden">
            <div className="bg-forest px-4 py-4 text-cream">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-wheat/80">
                {t("app.currentSetting")}
              </p>
              <p className="mt-1 font-display text-2xl text-cream">
                {activeMethod?.label ?? t("app.directPaymentFallback")}
              </p>
              <p className="mt-1 text-[0.65rem] leading-relaxed text-cream/55">
                {activeMethod?.description ?? t("app.agreedDirectly")}
              </p>
            </div>
            <div className="space-y-2 p-4 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-stone">UPI</span>
                <span className="font-semibold text-forest">
                  {shareUpi && upiId ? t("common.shared") : t("common.notShared")}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-stone">{t("app.paymentQr")}</span>
                <span className="font-semibold text-forest">
                  {shareQr && qrImage ? t("common.shared") : t("common.notShared")}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-stone">{t("app.bankTransfer")}</span>
                <span className="font-semibold text-forest">
                  {shareBank && bankAccountNumber ? t("common.shared") : t("common.notShared")}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-line/70 pt-2">
                <span className="text-stone">{t("app.cash")}</span>
                <span className="font-semibold text-forest">{t("common.alwaysAccepted")}</span>
              </div>
            </div>
          </Card>

          <Alert tone="warning" title={t("app.neverShareSecrets")}>
            <span className="flex items-start gap-2">
              <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
              <span>{t("app.paymentSafetyOwner")}</span>
            </span>
          </Alert>

          <div className="rounded-2xl border border-line/70 bg-paper/60 p-4">
            <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-stone">
              <ShieldCheck className="size-3.5" /> {t("app.howConfirmationWorks")}
            </p>
            <ol className="mt-2 space-y-2 text-[0.66rem] leading-relaxed text-stone">
              <li className="flex gap-2">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-forest/10 text-[0.55rem] font-bold text-forest">
                  1
                </span>
                {t("app.confirmStep1")}
              </li>
              <li className="flex gap-2">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-forest/10 text-[0.55rem] font-bold text-forest">
                  2
                </span>
                {t("app.confirmStep2")}
              </li>
              <li className="flex gap-2">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-forest/10 text-[0.55rem] font-bold text-forest">
                  3
                </span>
                {t("app.confirmStep3")}
              </li>
            </ol>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-forest/10 bg-forest/5 px-3.5 py-3 text-[0.66rem] leading-relaxed text-forest/80">
            <BadgeCheck className="size-4 shrink-0" />
            <span>{t("app.noCommissionNote")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
