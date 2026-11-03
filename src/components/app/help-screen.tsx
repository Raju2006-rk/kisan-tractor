"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CircleHelp,
  Clock3,
  HandCoins,
  KeyRound,
  LockKeyhole,
  PhoneCall,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Sprout,
  Wallet,
} from "lucide-react";
import {
  Alert,
  Badge,
  Card,
  buttonStyles,
} from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";

type SectionId = "booking" | "billing" | "pricing" | "cancellation" | "ivr" | "safety";

const SECTION_IDS: SectionId[] = [
  "booking",
  "billing",
  "pricing",
  "cancellation",
  "ivr",
  "safety",
];

const ICONS: Record<SectionId, typeof Sprout> = {
  booking: CalendarCheck,
  billing: HandCoins,
  pricing: Clock3,
  cancellation: CircleHelp,
  ivr: PhoneCall,
  safety: ShieldCheck,
};

export function HelpScreen() {
  const { t } = useI18n();
  const tr = (key: string) => t(key as Parameters<typeof t>[0]);

  const sections = SECTION_IDS.map((id) => ({
    id,
    title: tr(`help.section.${id}.title`),
    body: tr(`help.section.${id}.body`),
    points: [1, 2, 3, 4].map((index) => tr(`help.section.${id}.p${index}`)),
  }));

  const faqs = [1, 2, 3, 4, 5].map((index) => ({
    q: tr(`help.faq.q${index}`),
    a: tr(`help.faq.a${index}`),
  }));

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Badge tone="green" dot>
            <CircleHelp className="size-3" /> {t("help.badge")}
          </Badge>
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-stone/70">
            {t("help.region")}
          </span>
        </div>
        <h1 className="mt-2 font-display text-3xl text-forest sm:text-[2.4rem]">{t("help.title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone">{t("help.subtitle")}</p>
      </div>

      <Alert tone="info">
        <span className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          <span>{t("help.alert")}</span>
        </span>
      </Alert>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => {
          const Icon = ICONS[section.id];
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="group flex items-start gap-3 rounded-2xl border border-line/80 bg-paper p-4 shadow-[var(--shadow-card)] transition hover:border-forest/25"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-forest/8 text-forest">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-forest">{section.title}</span>
                <span className="mt-0.5 line-clamp-2 block text-[0.65rem] leading-relaxed text-stone">
                  {section.body}
                </span>
              </span>
              <ArrowRight className="ml-auto mt-1 size-3.5 shrink-0 text-stone transition group-hover:text-clay" />
            </a>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.45fr_0.55fr] lg:items-start">
        <div className="space-y-4">
          {sections.map((section) => {
            const Icon = ICONS[section.id];
            return (
              <Card key={section.id} className="scroll-mt-24 p-5 sm:p-6" as="section">
                <div id={section.id} className="scroll-mt-24" />
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-forest/8 text-forest">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <h2 className="font-display text-xl text-forest">{section.title}</h2>
                    <p className="mt-1 text-xs leading-relaxed text-stone">{section.body}</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-2">
                  {section.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-[0.72rem] leading-relaxed text-stone">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-moss" />
                      {point}
                    </li>
                  ))}
                </ul>
                {section.id === "billing" ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-wheat/60 bg-wheat/20 px-3.5 py-3">
                      <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#7a5a1d]">
                        <ReceiptText className="size-3" /> {t("help.billTitle")}
                      </p>
                      <p className="mt-1 text-[0.66rem] leading-relaxed text-[#6d5118]">
                        {t("help.billBody")}
                      </p>
                    </div>
                    <div className="rounded-xl border border-forest/15 bg-forest/5 px-3.5 py-3">
                      <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-forest">
                        <Wallet className="size-3" /> {t("help.receivedTitle")}
                      </p>
                      <p className="mt-1 text-[0.66rem] leading-relaxed text-forest/75">
                        {t("help.receivedBody")}
                      </p>
                    </div>
                  </div>
                ) : null}
                {section.id === "ivr" ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-clay/30 bg-clay/5 px-3.5 py-3">
                    <Badge tone="clay" dot>
                      {t("landing.ivr.comingSoon")}
                    </Badge>
                    <p className="text-[0.66rem] leading-relaxed text-clay-dark">
                      {t("help.ivrNoNumber")}
                    </p>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24">
          <Card className="p-5">
            <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-stone">
              <Sparkles className="size-3.5" /> {t("help.quickTitle")}
            </p>
            <div className="mt-3 space-y-2">
              <Link
                href="/bookings"
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-cream/40 px-3.5 py-2.5 text-xs font-semibold text-forest transition hover:border-forest/25"
              >
                {t("help.helpCta")}
                <ArrowRight className="size-3.5" />
              </Link>
              <Link
                href="/explore"
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-cream/40 px-3.5 py-2.5 text-xs font-semibold text-forest transition hover:border-forest/25"
              >
                {t("help.bookingsCta")}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </Card>

          <Card className="p-5">
            <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-stone">
              <LockKeyhole className="size-3.5" /> {t("help.safetyReminder")}
            </p>
            <ul className="mt-2.5 space-y-2 text-[0.68rem] leading-relaxed text-stone">
              <li className="flex gap-2">
                <KeyRound className="mt-0.5 size-3.5 shrink-0 text-clay" />
                {t("help.safety1")}
              </li>
              <li className="flex gap-2">
                <HandCoins className="mt-0.5 size-3.5 shrink-0 text-forest" />
                {t("help.safety2")}
              </li>
              <li className="flex gap-2">
                <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-sky" />
                {t("help.safety3")}
              </li>
            </ul>
          </Card>

          <div className="rounded-2xl border border-forest/10 bg-forest/5 p-4">
            <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-forest">
              <PhoneCall className="size-3.5" /> {t("help.phoneBooking")}
            </p>
            <p className="mt-1.5 text-[0.66rem] leading-relaxed text-forest/75">
              {t("help.phoneBookingBody")}
            </p>
            <Link href="#ivr" className={buttonStyles("outline", "sm", "mt-2.5")}>
              {t("help.readUpdate")}
            </Link>
          </div>
        </aside>
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="font-display text-2xl text-forest">{t("help.faqTitle")}</h2>
        <div className="mt-3 divide-y divide-line/70">
          {faqs.map((faq) => (
            <details key={faq.q} className="group py-3">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-semibold text-forest">
                {faq.q}
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-line text-stone transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 max-w-3xl text-[0.72rem] leading-relaxed text-stone">{faq.a}</p>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
