"use client";

import { useState } from "react";
import { Dumbbell } from "lucide-react";
import { isRenderableImageUrl } from "@/lib/strength/imageUrl";

interface ExerciseImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  /** Light styling for print / paper-style previews */
  variant?: "screen" | "print";
}

export function ExerciseImage({
  src,
  alt,
  className = "",
  variant = "screen",
}: ExerciseImageProps) {
  const [imgError, setImgError] = useState(false);
  const url = (src ?? "").trim();
  const canRender = isRenderableImageUrl(url) && !imgError;
  const isPrint = variant === "print";
  const shellClass = isPrint
    ? "relative h-full w-full overflow-hidden"
    : "relative overflow-hidden rounded-lg bg-zinc-800/50";
  const placeholderClass = isPrint
    ? "flex items-center justify-center rounded border border-neutral-200 bg-neutral-100 text-neutral-400"
    : "flex items-center justify-center rounded-lg bg-zinc-800/40 text-zinc-500";

  if (canRender) {
    return (
      <div
        className={`${shellClass} ${className} exercise-image-pair flex items-center justify-center ${
          isPrint ? "" : "p-1"
        }`}
      >
        {/* Native img: admin URLs may be any https host; avoids next/image config errors. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          className={
            isPrint
              ? "h-full w-full object-contain object-center"
              : "max-h-full max-w-full object-contain object-center"
          }
          onError={() => setImgError(true)}
        />
        <span
          className={`exercise-image-pair-gap pointer-events-none absolute top-[6%] bottom-[6%] left-1/2 z-[1] w-[2px] -translate-x-1/2 ${
            isPrint ? "bg-white" : "bg-zinc-800"
          }`}
          aria-hidden
        />
        <span
          className={`exercise-image-pair-line pointer-events-none absolute top-[6%] bottom-[6%] left-1/2 z-[2] w-px -translate-x-1/2 ${
            isPrint ? "bg-[#d0d0d0]" : "bg-neutral-500/70"
          }`}
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className={`${placeholderClass} ${className}`} aria-hidden>
      <Dumbbell className={`h-8 w-8 opacity-50 ${isPrint ? "text-neutral-400" : ""}`} />
    </div>
  );
}
