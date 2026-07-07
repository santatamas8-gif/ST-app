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
    ? "relative overflow-hidden rounded border border-neutral-200 bg-neutral-50"
    : "relative overflow-hidden rounded-lg bg-zinc-800/50";
  const placeholderClass = isPrint
    ? "flex items-center justify-center rounded border border-neutral-200 bg-neutral-100 text-neutral-400"
    : "flex items-center justify-center rounded-lg bg-zinc-800/40 text-zinc-500";

  if (canRender) {
    return (
      <div className={`${shellClass} ${className}`}>
        {/* Native img: admin URLs may be any https host; avoids next/image config errors. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
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
