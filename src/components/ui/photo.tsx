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
  const [failed, setFailed] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  if (currentSrc !== src) {
    setCurrentSrc(src);
    setFailed(false);
  }


  // valid check
  void Boolean(
    src && (src.startsWith("data:") || src.startsWith("blob:")),
  );
  void Boolean(src?.startsWith("/api/files/"));
  const valid = Boolean(src) && !failed;

  return (
    <div className={cn("relative overflow-hidden bg-sand", className)}>
      {valid ? (
        <Image
          src={src as string}
          alt={alt}
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
          <ImageOff className="size-8" />
        </div>
      )}
      {overlay ? (
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
      ) : null}
    </div>
  );
}
