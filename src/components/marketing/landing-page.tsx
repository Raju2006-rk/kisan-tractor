"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  HandCoins,
  Handshake,
  IndianRupee,
  Languages,
  MapPin,
  Menu,
  PhoneCall,
  ReceiptText,
  ShieldCheck,
  Sprout,
  Star,
  Tractor,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Photo } from "@/components/ui/photo";
import { TractorSceneLoader } from "@/components/three/tractor-scene-loader";
import { Badge, buttonStyles, Card, SectionHeading } from "@/components/ui/primitives";
import { PHOTOS, PRICING_UNITS, SERVICES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { formatRupees } from "@/lib/pricing";
import type { TractorWithOwner } from "@/lib/types";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "#find", key: "nav.findTractor" as const },
  { href: "#how", key: "nav.howItWorks" as const },
  { href: "#owners", key: "nav.forOwners" as const },
  { href: "#faq", key: "nav.about" as const },
];

const marqueeItems = [
  "Ploughing",
  "Rotavator",
  "Trolley transport",
  "Direct payments",
  "No commission",
  "Local owners",
  "Nashik, Maharashtra",
];

function Header() {
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-line/70 bg-cream/90 py-2.5 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent py-4",
      )}
    >
      <div className="container-page flex items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-7 lg:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[0.8rem] font-semibold text-forest/70 transition hover:text-forest"
            >
              {t(item.key)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <Link
            href="/auth"
            className={buttonStyles("primary", "sm", "hidden md:inline-flex")}
          >
            {t("nav.getStarted")}
            <ArrowRight className="size-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label="Open menu"
            className="flex size-9 items-center justify-center rounded-full border border-forest/15 bg-paper/70 text-forest lg:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {open ? (
        <div className="container-page lg:hidden">
          <div className="mt-3 space-y-1 rounded-2xl border border-line bg-paper p-3 shadow-soft">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-forest hover:bg-sand/50"
              >
                {t(item.key)}
                <ArrowUpRight className="size-3.5 opacity-50" />
              </a>
            ))}
            <div className="flex items-center justify-between gap-2 border-t border-line px-3 pt-3">
              <LanguageSwitcher align="left" />
              <Link href="/auth" className={buttonStyles("primary", "sm")}>
                {t("nav.getStarted")}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Hero() {
  const { t } = useI18n();
  return (
    <section className="landing-hero relative overflow-hidden pb-10 pt-28 sm:pt-32 lg:pb-16 lg:pt-36">
      <div className="pointer-events-none absolute inset-0 dotted-field opacity-[0.35]" />
      <div className="container-page relative grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <span className="eyebrow">{t("landing.hero.eyebrow")}</span>
          <h1 className="mt-5 text-balance font-display text-[2.7rem] leading-[0.98] text-forest sm:text-6xl lg:text-[4.4rem]">
            {t("landing.hero.title1")}
            <br />
            <span className="italic text-clay">{t("landing.hero.title2")}</span>
            <br />
            {t("landing.hero.title3")}
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-[0.95rem] leading-relaxed text-stone sm:text-base">
            {t("landing.hero.subtitle")}
          </p>
          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
            <Link href="/auth?role=farmer" className={buttonStyles("primary", "lg")}>
              {t("landing.hero.ctaFind")}
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/auth?role=owner" className={buttonStyles("outline", "lg")}>
              {t("landing.hero.ctaList")}
              <Tractor className="size-4" />
            </Link>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-forest/80">
            {[
              { icon: ShieldCheck, label: t("landing.hero.trust1") },
              { icon: HandCoins, label: t("landing.hero.trust2") },
              { icon: MapPin, label: t("landing.hero.trust3") },
            ].map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1.5">
                <item.icon className="size-3.5 text-moss" />
                {item.label}
              </span>
            ))}
          </div>
          <p className="mt-6 flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-stone/80">
            <span className="size-1.5 rounded-full bg-clay" />
            {t("landing.hero.proof")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
          className="relative"
        >
          <div className="relative h-[360px] overflow-hidden rounded-[2rem] border border-forest/10 bg-[radial-gradient(120%_100%_at_80%_0%,#f4e6c6_0%,#e6dcc1_42%,#c9cfb4_100%)] shadow-[0_30px_70px_-40px_rgba(22,59,42,0.55)] sm:h-[430px] lg:h-[500px]">
            <div className="absolute inset-0">
              <TractorSceneLoader />
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-5">
              <span className="rounded-full border border-forest/10 bg-paper/80 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-forest backdrop-blur">
                Niphad · Nashik
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-forest/10 bg-paper/80 px-3 py-1.5 text-[0.65rem] font-semibold text-forest backdrop-blur">
                <span className="size-1.5 rounded-full bg-forest pulse-ring" />
                Available today
              </span>
            </div>
            <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-2 sm:bottom-5 sm:left-5 sm:right-5">
              <div className="rounded-2xl border border-forest/10 bg-paper/85 px-3.5 py-2.5 backdrop-blur">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-stone">
                  Mahindra 575 DI
                </p>
                <p className="mt-0.5 text-xs font-semibold text-forest">
                  ₹800 / hour · Ramesh Shinde
                </p>
              </div>
              <div className="hidden items-center gap-1.5 rounded-full bg-forest px-3 py-2 text-[0.65rem] font-semibold text-cream sm:flex">
                <MapPin className="size-3" /> 2.4 km away
              </div>
            </div>
          </div>
          <div className="absolute -left-3 top-1/2 hidden -translate-y-1/2 rotate-[-4deg] rounded-2xl border border-line bg-paper px-3 py-2.5 shadow-soft sm:block">
            <p className="flex items-center gap-1.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-stone">
              <Check className="size-3 text-forest" /> Direct payment
            </p>
            <p className="mt-0.5 text-[0.7rem] font-semibold text-forest">
              Farmer → Owner
            </p>
          </div>
          <div className="absolute -right-2 bottom-12 hidden rotate-[3deg] rounded-2xl border border-line bg-paper px-3 py-2.5 shadow-soft md:block">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-stone">
              Final bill
            </p>
            <p className="font-display text-lg text-forest">₹1,200</p>
            <p className="text-[0.6rem] text-stone">90 active min · no break billed</p>
          </div>
        </motion.div>
      </div>

      <div className="container-page relative mt-10 lg:mt-14">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-forest/10 bg-paper/60 px-4 py-3 backdrop-blur sm:px-5">
          <div className="flex items-center gap-2 text-[0.7rem] font-semibold text-forest">
            <Sprout className="size-4 text-moss" />
            Built around real farm work
          </div>
          <div className="no-scrollbar flex flex-1 items-center gap-6 overflow-hidden text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-stone/70">
            <span className="hidden sm:inline">No commission</span>
            <span className="hidden sm:inline">No payment gateway</span>
            <span>Local owners</span>
            <span className="hidden md:inline">Clear rates</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  return (
    <div className="overflow-hidden border-y border-line/70 bg-forest py-3.5 text-cream">
      <div className="animate-marquee flex w-max items-center gap-8 whitespace-nowrap">
        {[...marqueeItems, ...marqueeItems].map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="flex items-center gap-8 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-cream/75"
          >
            {item}
            <span className="size-1 rounded-full bg-wheat/70" />
          </span>
        ))}
      </div>
    </div>
  );
}

function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    {
      n: "01",
      title: t("landing.how.step1"),
      body: t("landing.how.step1Body"),
      icon: MapPin,
    },
    {
      n: "02",
      title: t("landing.how.step2"),
      body: t("landing.how.step2Body"),
      icon: Handshake,
    },
    {
      n: "03",
      title: t("landing.how.step3"),
      body: t("landing.how.step3Body"),
      icon: HandCoins,
    },
  ];
  return (
    <section id="how" className="scroll-mt-24 py-16 sm:py-20 lg:py-24">
      <div className="container-page">
        <SectionHeading
          eyebrow="Simple from start to finish"
          title={t("landing.how.title")}
          body={t("landing.how.subtitle")}
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3 md:gap-5">
          {steps.map((step, index) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="relative"
            >
              <Card className="h-full p-6">
                <div className="flex items-start justify-between">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-forest/8 text-forest">
                    <step.icon className="size-5" />
                  </span>
                  <span className="font-display text-4xl text-wheat/90">{step.n}</span>
                </div>
                <h3 className="mt-5 font-display text-2xl text-forest">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone">{step.body}</p>
              </Card>
              {index < steps.length - 1 ? (
                <span className="absolute -right-3 top-1/2 hidden size-6 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-cream text-stone md:flex">
                  <ArrowRight className="size-3" />
                </span>
              ) : null}
            </motion.div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-line/70 bg-paper/60 px-5 py-4 text-xs text-stone">
          <span className="inline-flex items-center gap-1.5 font-semibold text-forest">
            <Clock3 className="size-3.5" /> Hourly work is billed on active time only
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ReceiptText className="size-3.5" /> The final bill is based on actual work
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" /> KisanTractor holds no money
          </span>
        </div>
      </div>
    </section>
  );
}

function Services() {
  const { t } = useI18n();
  return (
    <section id="services" className="scroll-mt-24 bg-[#f1ead9] py-16 sm:py-20 lg:py-24">
      <div className="container-page">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <SectionHeading
            eyebrow="Local owners, ready to help"
            title={t("landing.services.title")}
            body={t("landing.services.subtitle")}
          />
          <Link href="/explore" className={buttonStyles("outline", "sm", "shrink-0")}>
            Explore services <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service, index) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: index * 0.06 }}
            >
              <Link
                href={`/explore?service=${service.id}`}
                className="group block overflow-hidden rounded-[1.5rem] border border-line bg-paper shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-soft"
              >
                <Photo
                  src={service.image}
                  alt={service.name}
                  className="h-40 w-full"
                  imageClassName="transition duration-700 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
                <div className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-xl text-forest">{service.name}</h3>
                    <ArrowUpRight className="size-4 text-stone transition group-hover:text-clay" />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-stone">{service.short}</p>
                  <p className="mt-3 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-moss">
                    {service.unitHint}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TractorCard({ tractor }: { tractor: TractorWithOwner }) {
  const rates = [
    tractor.pricing.hourlyEnabled && {
      label: "Hourly",
      value: tractor.pricing.hourlyRate,
      unit: PRICING_UNITS.hourly,
    },
    tractor.pricing.acreEnabled && {
      label: "Per acre",
      value: tractor.pricing.acreRate,
      unit: PRICING_UNITS.acre,
    },
    tractor.pricing.tripEnabled && {
      label: "Per trip",
      value: tractor.pricing.tripRate,
      unit: PRICING_UNITS.trip,
    },
  ].filter(Boolean) as { label: string; value: number; unit: string }[];

  return (
    <Link
      href={`/tractors/${tractor.id}`}
      className="group block overflow-hidden rounded-[1.5rem] border border-line bg-paper shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-soft"
    >
      <div className="relative">
        <Photo
          src={tractor.image}
          alt={`${tractor.brand} ${tractor.model}`}
          className="h-48 w-full"
          imageClassName="transition duration-700 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Badge tone="green" dot>
            Available
          </Badge>
          <Badge tone="stone">{tractor.horsepower} HP</Badge>
        </div>
        <span className="absolute bottom-3 right-3 rounded-full bg-ink/70 px-2.5 py-1 text-[0.65rem] font-semibold text-cream backdrop-blur">
          {tractor.distanceKm} km from Nashik
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl text-forest">
              {tractor.brand} {tractor.model}
            </h3>
            <p className="mt-0.5 text-xs text-stone">
              {tractor.owner.name} · {tractor.village}, {tractor.district}
            </p>
          </div>
          <span className="flex items-center gap-0.5 rounded-full bg-wheat/25 px-2 py-1 text-[0.65rem] font-semibold text-[#7a5a1d]">
            <Star className="size-3 fill-current" /> 4.8
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {rates.map((rate) => (
            <span
              key={rate.label}
              className="rounded-lg border border-line/80 bg-cream/60 px-2 py-1 text-[0.65rem] font-semibold text-forest"
            >
              {formatRupees(rate.value)}
              <span className="font-normal text-stone">{rate.unit}</span>
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function NearbyTractors() {
  const { t } = useI18n();
  const { data, isLoading } = useSWR<{ tractors: TractorWithOwner[] }>(
    "/api/tractors?lat=19.9975&lng=73.7898",
  );
  const tractors = data?.tractors?.slice(0, 3) ?? [];

  return (
    <section id="find" className="scroll-mt-24 py-16 sm:py-20 lg:py-24">
      <div className="container-page">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <SectionHeading
            eyebrow="A look around Niphad, Nashik"
            title={t("landing.nearby.title")}
            body={t("landing.nearby.subtitle")}
          />
          <Link href="/explore" className={buttonStyles("primary", "sm", "shrink-0")}>
            {t("landing.nearby.cta")} <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {isLoading
            ? [0, 1, 2].map((item) => (
                <div key={item} className="h-80 animate-pulse rounded-[1.5rem] bg-sand/70" />
              ))
            : tractors.map((tractor) => (
                <TractorCard key={tractor.id} tractor={tractor} />
              ))}
        </div>
        <p className="mt-4 text-center text-[0.7rem] text-stone">
          Rates vary by equipment and owner. Your selected rate is shown before you send a booking request.
        </p>
      </div>
    </section>
  );
}

function DirectPayment() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden bg-forest py-16 text-cream sm:py-20 lg:py-24">
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(#f7f2e6_1px,transparent_1px)] [background-size:26px_26px]" />
      <div className="container-page relative grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <span className="eyebrow !text-wheat">Farmer → Tractor owner</span>
          <h2 className="mt-4 text-balance font-display text-3xl leading-tight sm:text-4xl lg:text-[2.9rem]">
            {t("landing.payment.title")}
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-cream/70">
            {t("landing.payment.subtitle")}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 rounded-full border border-cream/15 bg-cream/5 px-3.5 py-2 text-xs font-semibold">
              <Users className="size-3.5 text-wheat" /> Farmer
            </span>
            <span className="flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-wheat/80">
              <ArrowRight className="size-4" /> Direct
            </span>
            <span className="flex items-center gap-2 rounded-full border border-cream/15 bg-cream/5 px-3.5 py-2 text-xs font-semibold">
              <Tractor className="size-3.5 text-wheat" /> Tractor owner
            </span>
          </div>
          <ul className="mt-7 space-y-2.5 text-sm text-cream/75">
            {[
              "No commission. No transaction charge. No money held.",
              "Pay by UPI, cash, bank transfer or another agreed method.",
              "Only the tractor owner confirms payment received.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-wheat" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="rounded-[1.75rem] border border-cream/15 bg-cream p-5 text-ink shadow-[0_30px_70px_-30px_rgba(0,0,0,0.5)] sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-stone">
                  Final Bill Amount
                </p>
                <p className="mt-1 font-display text-4xl text-forest">₹1,200</p>
              </div>
              <span className="flex size-11 items-center justify-center rounded-2xl bg-forest/8 text-forest">
                <ReceiptText className="size-5" />
              </span>
            </div>
            <div className="mt-4 space-y-2 rounded-2xl bg-cream/80 p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone">Ploughing · Mahindra 575 DI</span>
                <span className="font-semibold text-forest">₹800 / hour</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone">Active work</span>
                <span className="font-semibold text-forest">90 minutes</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone">Break · not billed</span>
                <span className="font-semibold text-forest">30 minutes</span>
              </div>
              <div className="border-t border-line pt-2 text-[0.68rem] text-stone">
                90 min ÷ 60 × ₹800 = ₹1,200
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-line px-3.5 py-3">
              <div>
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-stone">
                  Payment Received
                </p>
                <p className="mt-0.5 text-xs font-semibold text-clay-dark">
                  Not yet confirmed by owner
                </p>
              </div>
              <span className="rounded-full bg-clay/10 px-2.5 py-1 text-[0.65rem] font-semibold text-clay-dark">
                Direct payment
              </span>
            </div>
            <p className="mt-4 flex items-start gap-2 text-[0.68rem] leading-relaxed text-stone">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-forest" />
              Recording a payment is not a receipt. Only the tractor owner confirms payment received.
            </p>
          </div>
          <div className="absolute -bottom-4 -right-3 hidden rotate-[2deg] rounded-2xl bg-wheat px-4 py-2.5 text-ink shadow-soft sm:block">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-forest/60">
              Platform charges
            </p>
            <p className="font-display text-xl text-forest">₹0</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function OwnerSection() {
  const { t } = useI18n();
  return (
    <section id="owners" className="scroll-mt-24 py-16 sm:py-20 lg:py-24">
      <div className="container-page grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
        <div className="relative">
          <Photo
            src={PHOTOS.ownerDriver}
            alt="Tractor owner in his field"
            className="aspect-[4/5] w-full rounded-[2rem] sm:aspect-[5/4] lg:aspect-[4/5]"
            sizes="(max-width: 1024px) 100vw, 45vw"
          />
          <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-cream/20 bg-forest/85 p-4 text-cream backdrop-blur">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-wheat">
              Ramesh Shinde · Niphad
            </p>
            <p className="mt-1 font-display text-xl">
              “My tractor, my rates. The farmer pays me directly.”
            </p>
            <div className="mt-2 flex items-center gap-3 text-[0.65rem] text-cream/65">
              <span>50 HP Mahindra 575 DI</span>
              <span className="size-1 rounded-full bg-cream/30" />
              <span>₹42,600 recorded this month</span>
            </div>
          </div>
        </div>
        <div>
          <span className="eyebrow">{t("landing.owner.eyebrow")}</span>
          <h2 className="mt-4 text-balance font-display text-3xl leading-tight text-forest sm:text-4xl lg:text-[2.9rem]">
            {t("landing.owner.title")}
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-stone">
            {t("landing.owner.subtitle")}
          </p>
          <ul className="mt-7 space-y-3">
            {[
              t("landing.owner.benefit1"),
              t("landing.owner.benefit2"),
              t("landing.owner.benefit3"),
            ].map((item, index) => (
              <li key={item} className="flex items-start gap-3 rounded-2xl border border-line/70 bg-paper/60 px-4 py-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-forest/8 text-forest">
                  {index === 0 ? (
                    <IndianRupee className="size-3.5" />
                  ) : index === 1 ? (
                    <CalendarDays className="size-3.5" />
                  ) : (
                    <Wallet className="size-3.5" />
                  )}
                </span>
                <span className="text-sm font-medium text-forest/85">{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/auth?role=owner" className={buttonStyles("clay", "lg")}>
              {t("landing.owner.cta")} <ArrowRight className="size-4" />
            </Link>
            <p className="text-[0.7rem] leading-relaxed text-stone">
              No commission. No platform wallet.
              <br />
              Farmers pay you directly.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function IvrSection() {
  const { t } = useI18n();
  const flow = ["Language", "Location", "Farming work", "Booking request"];
  return (
    <section className="py-16 sm:py-20">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-[2rem] border border-wheat/70 bg-[linear-gradient(135deg,#f4e7c7_0%,#efe0bb_55%,#e7d6ac_100%)] p-6 sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full border border-forest/10" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 size-64 rounded-full border border-forest/10" />
          <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-forest/15 bg-paper/70 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-forest">
                <PhoneCall className="size-3.5" /> {t("landing.ivr.badge")}
              </span>
              <h2 className="mt-4 text-balance font-display text-3xl leading-tight text-forest sm:text-4xl">
                {t("landing.ivr.title")}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-forest/70">
                {t("landing.ivr.subtitle")}
              </p>
              <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-forest/65">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                {t("landing.ivr.body")}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-forest/10 bg-paper/75 p-5 backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-stone">
                  Future flow
                </p>
                <span className="rounded-full bg-wheat/50 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-forest">
                  Coming soon
                </span>
              </div>
              <ol className="mt-4 space-y-2">
                {flow.map((item, index) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 rounded-xl border border-line/70 bg-cream/60 px-3 py-2.5 text-xs font-semibold text-forest"
                  >
                    <span className="flex size-6 items-center justify-center rounded-full bg-forest text-[0.62rem] text-cream">
                      {index + 1}
                    </span>
                    {item}
                    <ArrowRight className="ml-auto size-3.5 text-stone/50" />
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-[0.65rem] leading-relaxed text-stone">
                No phone number is shown until the IVR service is live. The future service will use the same KisanTractor backend.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const faqs = [
  {
    q: "Does KisanTractor charge a commission?",
    a: "No. There is no commission or transaction charge. Pay the tractor owner directly; we do not hold your money.",
  },
  {
    q: "Can I book for a family member?",
    a: "Yes. Choose “Book for someone else” and add their name and mobile. They do not need a separate account.",
  },
  {
    q: "Am I charged for breaks during hourly work?",
    a: "No. Only active work time is billed at your agreed rate. Paused time is recorded separately and excluded.",
  },
  {
    q: "What if I have a billing or payment issue?",
    a: "Report the issue from the booking. The original bill stays available while the issue is reviewed.",
  },
  {
    q: "How does payment work?",
    a: "After the work is finished, the final bill is calculated. You pay the tractor owner directly using UPI, cash, bank transfer or another agreed method. The owner confirms receipt.",
  },
];

function Faq() {
  const { t } = useI18n();
  return (
    <section id="faq" className="scroll-mt-24 bg-[#f1ead9] py-16 sm:py-20 lg:py-24">
      <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <SectionHeading eyebrow="A few things you may want to know" title={t("landing.faq.title")} body={t("landing.faq.subtitle")} />
        <div className="divide-y divide-line/80 border-y border-line/80">
          {faqs.map((faq) => (
            <details key={faq.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-forest">
                {faq.q}
                <ChevronDown className="size-4 shrink-0 text-stone transition group-open:rotate-180" />
              </summary>
              <p className="mt-2.5 max-w-2xl text-xs leading-relaxed text-stone">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden">
      <Photo
        src={PHOTOS.fieldAerial}
        alt="Aerial view of farm fields"
        className="absolute inset-0 h-full w-full"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-forest/85" />
      <div className="container-page relative py-20 text-center sm:py-24">
        <span className="eyebrow !text-wheat">Better connections. Stronger villages.</span>
        <h2 className="mx-auto mt-4 max-w-3xl text-balance font-display text-3xl leading-tight text-cream sm:text-4xl lg:text-5xl">
          {t("landing.cta.title")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-cream/70">
          {t("landing.cta.subtitle")}
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
          <Link href="/auth?role=farmer" className={buttonStyles("secondary", "lg")}>
            {t("landing.cta.button")} <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/auth?role=owner"
            className={buttonStyles("outline", "lg", "border-cream/25 text-cream hover:bg-cream/10")}
          >
            List your tractor
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="bg-[#102b1e] pb-8 pt-14 text-cream">
      <div className="container-page">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo variant="light" showTag />
            <p className="mt-4 max-w-xs text-xs leading-relaxed text-cream/60">
              {t("footer.tagline")}
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-cream/10 px-3 py-1.5 text-[0.65rem] text-cream/60">
              <MapPin className="size-3" /> Nashik, Maharashtra
            </p>
          </div>
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-wheat/80">
              {t("footer.explore")}
            </p>
            <ul className="mt-3 space-y-2 text-xs text-cream/65">
              <li><Link href="/explore" className="hover:text-cream">{t("footer.find")}</Link></li>
              <li><a href="#how" className="hover:text-cream">{t("footer.how")}</a></li>
              <li><Link href="/auth?role=owner" className="hover:text-cream">{t("footer.list")}</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-wheat/80">
              {t("footer.support")}
            </p>
            <ul className="mt-3 space-y-2 text-xs text-cream/65">
              <li><Link href="/help" className="hover:text-cream">{t("footer.help")}</Link></li>
              <li><Link href="/help#billing" className="hover:text-cream">{t("footer.billing")}</Link></li>
              <li><Link href="/help#safety" className="hover:text-cream">{t("footer.safety")}</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-wheat/80">
              {t("footer.language")}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-cream/65">
              <Languages className="size-3.5" />
              <span>English · हिंदी · मराठी</span>
            </div>
            <p className="mt-2 text-[0.65rem] text-cream/40">
              தமிழ் · తెలుగు · ಕನ್ನಡ · More coming soon
            </p>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-cream/10 pt-5 text-[0.65rem] text-cream/45 sm:flex-row sm:items-center">
          <p>{t("footer.rights")}</p>
          <div className="flex items-center gap-5">
            <span>{t("footer.privacy")}</span>
            <span>{t("footer.terms")}</span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-3" /> Direct payments only
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <Header />
      <main>
        <Hero />
        <Marquee />
        <HowItWorks />
        <Services />
        <NearbyTractors />
        <DirectPayment />
        <OwnerSection />
        <IvrSection />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
