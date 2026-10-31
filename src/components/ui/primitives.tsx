"use client";

import {
  forwardRef,
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import { STATUS_META } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import type { BookingStatus, Role } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

type ButtonVariant = "primary" | "clay" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export function buttonStyles(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" && "h-9 px-4 text-xs",
    size === "md" && "h-11 px-5 text-sm",
    size === "lg" && "h-13 px-7 text-[0.95rem]",
    variant === "primary" &&
      "btn-shine bg-forest text-cream shadow-[0_10px_24px_-14px_rgba(22,59,42,0.9)] hover:bg-forest-600",
    variant === "clay" &&
      "btn-shine bg-clay text-paper shadow-[0_10px_24px_-14px_rgba(180,85,47,0.9)] hover:bg-clay-dark",
    variant === "secondary" && "bg-wheat text-ink hover:bg-[#d8bb7c]",
    variant === "outline" &&
      "border border-forest/20 bg-transparent text-forest hover:border-forest/40 hover:bg-forest/5",
    variant === "ghost" && "text-forest hover:bg-forest/8",
    variant === "danger" && "border border-clay/25 bg-clay/8 text-clay-dark hover:bg-clay/15",
    className,
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonStyles(variant, size, className)}>
      {children}
    </Link>
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
  }
>(function Button(
  { className, variant = "primary", size = "md", loading, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={buttonStyles(variant, size, className)}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
});

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Tag
      className={cn(
        "rounded-[1.5rem] border border-line/80 bg-paper shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

type Tone = "green" | "amber" | "clay" | "stone" | "blue" | "red" | "outline";

export function Badge({
  children,
  tone = "stone",
  className,
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  const tones: Record<Tone, string> = {
    green: "bg-forest/9 text-forest border-forest/15",
    amber: "bg-wheat/35 text-[#7a5a1d] border-wheat/60",
    clay: "bg-clay/10 text-clay-dark border-clay/20",
    stone: "bg-sand/60 text-stone border-line",
    blue: "bg-sky/10 text-sky border-sky/20",
    red: "bg-red-50 text-red-700 border-red-200",
    outline: "bg-transparent text-forest border-forest/20",
  };
  const dotColors: Record<Tone, string> = {
    green: "bg-forest",
    amber: "bg-[#b58a2d]",
    clay: "bg-clay",
    stone: "bg-stone",
    blue: "bg-sky",
    red: "bg-red-500",
    outline: "bg-forest",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold",
        tones[tone],
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", dotColors[tone])} /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
  role = "farmer",
  className,
}: {
  status: BookingStatus;
  role?: Role;
  className?: string;
}) {
  const { statusLabel } = useI18n();
  const meta = STATUS_META[status];
  const tone = meta.tone as Tone;
  return (
    <Badge tone={tone} dot className={className}>
      {role === "owner" ? meta.ownerLabel : statusLabel(status)}
    </Badge>
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-baseline justify-between gap-3 text-[0.8rem] font-semibold text-forest"
      >
        <span>
          {label}
          {required ? <span className="ml-0.5 text-clay">*</span> : null}
        </span>
        {hint ? <span className="text-[0.68rem] font-normal text-stone">{hint}</span> : null}
      </label>
      {children}
      {error ? <p className="text-xs text-clay-dark">{error}</p> : null}
    </div>
  );
}

const fieldBase =
  "w-full rounded-xl border border-line bg-paper px-3.5 text-sm text-ink placeholder:text-stone/60 transition focus:border-forest/50 focus:ring-4 focus:ring-forest/8 focus:outline-none disabled:bg-sand/40 disabled:text-stone";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldBase, "h-11", className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, "min-h-24 py-3", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(fieldBase, "h-11 pr-8", className)} {...props}>
        {children}
      </select>
    );
  },
);

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start justify-between gap-4",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="space-y-1">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description ? (
          <span className="block text-xs leading-relaxed text-stone">{description}</span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === "string" ? label : "Toggle"}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-forest" : "bg-line",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-paper shadow transition-all",
            checked ? "left-[1.4rem]" : "left-0.5",
          )}
        />
      </button>
    </label>
  );
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-forest/10 font-display font-semibold text-forest",
        size === "sm" && "size-8 text-xs",
        size === "md" && "size-10 text-sm",
        size === "lg" && "size-14 text-lg",
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-forest", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-sand/80", className)} />;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-line bg-paper/60 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-sand/70 text-moss">
          {icon}
        </span>
      ) : null}
      <p className="font-display text-xl text-forest">{title}</p>
      {body ? <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-stone">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warning" | "success" | "danger";
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-forest/15 bg-forest/[0.045] text-forest",
    warning: "border-wheat/70 bg-wheat/20 text-[#6d5118]",
    success: "border-forest/20 bg-forest/8 text-forest",
    danger: "border-clay/25 bg-clay/8 text-clay-dark",
  };
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn("rounded-2xl border px-4 py-3.5 text-xs leading-relaxed", tones[tone], className)}
    >
      {title ? <p className="mb-1 text-[0.8rem] font-bold">{title}</p> : null}
      {children}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-line bg-paper shadow-soft sm:rounded-[1.75rem]",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-2xl",
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <div>
            <h2 className="font-display text-2xl text-forest">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm leading-relaxed text-stone">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sand/60 text-stone transition hover:bg-sand"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line/70 bg-paper px-5 py-4 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  body?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn(align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 className="mt-3 text-balance font-display text-3xl text-forest sm:text-4xl md:text-[2.75rem]">
        {title}
      </h2>
      {body ? (
        <p
          className={cn(
            "mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-stone sm:text-[0.95rem]",
            align === "center" && "mx-auto",
          )}
        >
          {body}
        </p>
      ) : null}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "no-scrollbar flex w-full gap-1 overflow-x-auto rounded-full border border-line bg-paper/80 p-1",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition",
            value === option.value
              ? "bg-forest text-cream"
              : "text-stone hover:bg-sand/60 hover:text-forest",
          )}
        >
          {option.label}
          {typeof option.count === "number" ? (
            <span
              className={cn(
                "rounded-full px-1.5 text-[0.62rem]",
                value === option.value ? "bg-cream/20" : "bg-sand text-stone",
              )}
            >
              {option.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
