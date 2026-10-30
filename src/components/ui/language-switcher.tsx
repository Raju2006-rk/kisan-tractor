"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe2 } from "lucide-react";
import { LANGUAGES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({
  variant = "light",
  align = "right",
}: {
  variant?: "light" | "dark";
  align?: "left" | "right";
}) {
  const { language, setLanguage } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const current = LANGUAGES.find((item) => item.code === language) ?? LANGUAGES[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition",
          variant === "light"
            ? "border-forest/15 bg-paper/70 text-forest hover:border-forest/30"
            : "border-cream/20 bg-cream/5 text-cream hover:bg-cream/10",
        )}
      >
        <Globe2 className="size-3.5 opacity-70" />
        <span>{current.native}</span>
        <ChevronDown className={cn("size-3 opacity-60 transition", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          role="listbox"
          className={cn(
            "absolute z-50 mt-2 max-h-[22rem] w-60 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-paper p-1.5 shadow-soft",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {LANGUAGES.map((item) => (
            <button
              key={item.code}
              type="button"
              role="option"
              aria-selected={language === item.code}
              onClick={() => {
                setLanguage(item.code);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition",
                language === item.code
                  ? "bg-forest/8 text-forest"
                  : "text-stone hover:bg-sand/60 hover:text-ink",
              )}
            >
              <span className="flex items-center gap-2">
                <span>{item.native}</span>
                <span className="text-[0.65rem] uppercase tracking-wide opacity-60">
                  {item.label}
                </span>
              </span>
              {language === item.code ? <Check className="size-3.5" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
