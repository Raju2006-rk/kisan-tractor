import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-forest text-wheat",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="size-6" fill="none">
        <path
          d="M4 21.5h24M7 21.5v-4.2h8.4l1.9-4.6h5.1l2.1 4.6H25v4.2"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10.4" cy="23" r="2.4" fill="currentColor" />
        <circle cx="22.4" cy="23" r="3.1" fill="currentColor" />
        <circle cx="22.4" cy="23" r="1.2" fill="#163b2a" />
        <path d="M17 12.7V8.5h4.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Logo({
  href = "/",
  variant = "dark",
  className,
  showTag = false,
}: {
  href?: string;
  variant?: "dark" | "light";
  className?: string;
  showTag?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="KisanTractor home"
    >
      <LogoMark className={variant === "light" ? "bg-wheat text-forest" : undefined} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-[1.35rem] tracking-tight",
            variant === "light" ? "text-cream" : "text-forest",
          )}
        >
          Kisan<span className="italic">Tractor</span>
        </span>
        {showTag ? (
          <span
            className={cn(
              "mt-1 text-[0.55rem] font-semibold uppercase tracking-[0.24em]",
              variant === "light" ? "text-cream/55" : "text-moss",
            )}
          >
            Rooted in local trust
          </span>
        ) : null}
      </span>
    </Link>
  );
}
