"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function Photo({
  src,
  alt,
  className,
  imageClassName,
  sizes = "(max-width: 768px) 100vw, 33vw",
  priority = false,
  overlay = false,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  /** Above-the-fold/LCP image: loads eagerly with high fetch priority. */
  priority?: boolean;
  overlay?: boolean;
}) {
  const cleanSrc = typeof src === "string" ? src.trim() : "";
  const [failed, setFailed] = useState(false);
  const [prevSrc, setPrevSrc] = useState(cleanSrc);

  if (prevSrc !== cleanSrc) {
    setPrevSrc(cleanSrc);
    setFailed(false);
  }

  const valid = Boolean(cleanSrc) && !failed;

  return (
    <div className={cn("relative overflow-hidden bg-sand", className)}>
      {valid ? (
        <Image
          src={cleanSrc}
          alt={alt || "Photo"}
          fill
          sizes={sizes}
          unoptimized={true}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          onError={() => setFailed(true)}
          className={cn("object-cover", imageClassName)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,#e8dcc2,#cdbb97)] text-forest/40">
          <ImageOff className="size-8" aria-hidden="true" />
        </div>
      )}
      {overlay ? (
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
      ) : null}
    </div>
  );
}
