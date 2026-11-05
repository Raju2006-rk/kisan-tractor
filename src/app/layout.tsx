import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope, Noto_Sans_Devanagari } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import type { Language } from "@/lib/types";
import { LANGUAGES, RTL_LANGUAGES } from "@/lib/constants";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari", "latin"],
  variable: "--font-noto-devanagari",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "KisanTractor — Book a Tractor. Directly Connect.",
    template: "%s · KisanTractor",
  },
  description:
    "Find nearby tractors and local tractor owners. Clear rates, direct payments, and farm work recorded from start to finish.",
  metadataBase: new URL("https://kisantractor.example"),
  openGraph: {
    title: "KisanTractor — Book a Tractor. Directly Connect.",
    description:
      "Find nearby tractors, agree on a clear rate and connect directly with the owner. No commission, no payment gateway.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#163b2a",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const cookieLanguage = jar.get("kt_lang")?.value;
  const initialLanguage: Language =
    cookieLanguage && LANGUAGES.some((item) => item.code === cookieLanguage)
      ? (cookieLanguage as Language)
      : "en";
  const direction = RTL_LANGUAGES.includes(initialLanguage) ? "rtl" : "ltr";
  const initialLanguageSelected = jar.get("kt_lang_selected")?.value === "1";

  return (
    <html
      lang={initialLanguage}
      dir={direction}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${fraunces.variable} ${manrope.variable} ${devanagari.variable}`}
    >
      <body className="antialiased">
        <AppProviders
          initialLanguage={initialLanguage}
          initialLanguageSelected={initialLanguageSelected}
        >
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
