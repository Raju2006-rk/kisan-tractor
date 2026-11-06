"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ArrowRight, Check, Globe2, Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { LANGUAGES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import type { Language } from "@/lib/types";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

function getSessionUnlockedSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem("kt_lang_session_unlocked") === "1";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

export function LanguageGateway({
  initiallySelected = false,
}: {
  /** Server cookie value */
  initiallySelected?: boolean;
}) {
  // Reference initiallySelected to indicate it's acknowledged
  void initiallySelected;
  const { language, setLanguage } = useI18n();
  const isSessionUnlocked = useSyncExternalStore(
    emptySubscribe,
    getSessionUnlockedSnapshot,
    getServerSnapshot,
  );
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      try {
        const savedLang = window.localStorage.getItem("kt_lang");
        if (savedLang && LANGUAGES.some((l) => l.code === savedLang)) {
          return savedLang as Language;
        }
      } catch {
        // fallback
      }
    }
    return language;
  });

  // When opening website/app, language selection must display first, and app only opens after confirmation.
  const isVisible = !isSessionUnlocked && !hasConfirmed;

  useEffect(() => {
    if (!isVisible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isVisible]);

  // Most commonly used Indian regional farming languages prioritized first
  const sortedLanguages = useMemo(() => {
    const priority = ["hi", "kn", "te", "mr", "ta", "gu", "pa", "bn", "ml", "en"];
    return [...LANGUAGES].sort((a, b) => {
      const idxA = priority.indexOf(a.code);
      const idxB = priority.indexOf(b.code);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.label.localeCompare(b.label);
    });
  }, []);

  function handleSelect(code: Language) {
    setSelectedLang(code);
    setLanguage(code);
  }

  function confirmLanguage() {
    setLanguage(selectedLang);
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem("kt_lang_session_unlocked", "1");
        window.localStorage.setItem("kt_lang_selected", "true");
        window.localStorage.setItem("kt_lang", selectedLang);
        document.cookie = `kt_lang_selected=1; path=/; max-age=31536000; samesite=lax`;
        document.cookie = `kt_lang=${selectedLang}; path=/; max-age=31536000; samesite=lax`;
      } catch {
        // Storage access may fail in private mode
      }
    }
    setHasConfirmed(true);
  }

  if (!isVisible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="language-dialog-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-stone-950/90 p-3 sm:p-5 backdrop-blur-lg"
    >
      <div className="relative my-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-line bg-paper shadow-2xl">
        {/* Top banner */}
        <div className="border-b border-line/80 bg-gradient-to-r from-forest/15 via-wheat/30 to-sand/60 px-6 py-6 text-center sm:px-8">
          <div className="mx-auto flex justify-center">
            <Logo />
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-forest/20 bg-forest/8 px-3 py-1 text-[0.68rem] font-semibold text-forest">
            <Sparkles className="size-3 text-clay" />
            <span>ನಮಸ್ಕಾರ · नमस्ते · Welcome · నమస్కారం · வணக்கம் · नमस्कार</span>
          </div>
          <h2 id="language-dialog-title" className="mt-3 font-display text-2xl text-forest sm:text-3xl">
            Choose Your Language
          </h2>
          <p className="mt-1 text-xs text-stone sm:text-sm">
            अपनी भाषा चुनें · ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ · మీ భాషను ఎంచుకోండి
          </p>
          <p className="mt-0.5 text-[0.7rem] text-stone/80">
            Select your preferred language to open and enter the app
          </p>
        </div>

        {/* Language Grid */}
        <div className="max-h-[50vh] overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
            {sortedLanguages.map((lang) => {
              const active = selectedLang === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelect(lang.code)}
                  onDoubleClick={confirmLanguage}
                  className={cn(
                    "group relative flex flex-col items-start justify-between rounded-2xl border p-3.5 text-left transition-all duration-150 cursor-pointer",
                    active
                      ? "border-forest bg-forest/[0.08] text-forest shadow-sm ring-2 ring-forest/30"
                      : "border-line bg-sand/30 text-ink hover:border-forest/30 hover:bg-sand/60",
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="font-display text-base font-semibold leading-snug sm:text-lg">
                      {lang.native}
                    </span>
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.65rem] transition",
                        active
                          ? "border-forest bg-forest text-cream"
                          : "border-line bg-paper text-transparent group-hover:border-forest/40",
                      )}
                    >
                      <Check className="size-3 stroke-[3]" />
                    </span>
                  </div>
                  <span className="mt-1 text-[0.68rem] font-medium text-stone">
                    {lang.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-line/80 bg-paper px-6 py-4 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2 text-xs text-stone">
            <Globe2 className="size-4 text-forest" />
            <span>Select language to open KisanTractor</span>
          </div>
          <button
            type="button"
            onClick={confirmLanguage}
            className="btn-shine flex h-11 w-full items-center justify-center gap-2 rounded-full bg-forest px-6 text-sm font-semibold text-cream shadow-[0_10px_24px_-14px_rgba(22,59,42,0.9)] transition hover:bg-forest-600 sm:w-auto cursor-pointer"
          >
            <span>Continue / आगे बढ़ें</span>
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
