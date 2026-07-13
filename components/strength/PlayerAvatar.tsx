"use client";

import { useState } from "react";
import { PROFILE_AVATAR_IMG_CLASS } from "@/lib/players/profileAvatarStyles";
import { User } from "lucide-react";

function playerMonogram(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (parts[0][0] ?? "?").toUpperCase();
}

interface PlayerAvatarProps {
  name: string;
  avatarUrl: string | null | undefined;
  variant?: "screen" | "print";
  /** Strength cards use a rectangular photo; profiles keep the default circle. */
  shape?: "circle" | "rect";
  className?: string;
}

export function PlayerAvatar({
  name,
  avatarUrl,
  variant = "screen",
  shape = "circle",
  className = "",
}: PlayerAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const url = (avatarUrl ?? "").trim();
  const showImage = Boolean(url) && !imgError;
  const monogram = playerMonogram(name);
  const isPrint = variant === "print";
  const isRect = shape === "rect";

  const sizeClass = isRect
    ? isPrint
      ? "player-avatar-print player-avatar-print--rect h-[34mm] w-[26mm] text-[11pt]"
      : "h-[5.5rem] w-[4.25rem] text-base sm:h-24 sm:w-[4.75rem] sm:text-lg"
    : isPrint
      ? "player-avatar-print h-[26mm] w-[26mm] text-[11pt]"
      : "h-16 w-16 text-base sm:h-[4.5rem] sm:w-[4.5rem] sm:text-lg";

  const shellClass = isRect
    ? isPrint
      ? showImage
        ? "rounded-md border border-neutral-200 bg-neutral-50"
        : "rounded-md border border-neutral-200 bg-neutral-100 text-neutral-600"
      : "rounded-lg bg-zinc-800/50 ring-1 ring-zinc-600 text-zinc-300"
    : isPrint
      ? showImage
        ? "rounded-full"
        : "rounded-full border border-neutral-200 bg-neutral-100 text-neutral-600"
      : "rounded-full bg-zinc-700 ring-2 ring-zinc-600 text-zinc-300";

  const imageClass = isRect
    ? "max-h-full max-w-full object-contain object-center"
    : isPrint
      ? "h-full w-full object-cover object-[50%_20%]"
      : PROFILE_AVATAR_IMG_CLASS;

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${sizeClass} ${shellClass} ${className} flex items-center justify-center`}
      aria-hidden={!name}
    >
      {showImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            className={imageClass}
            onError={() => setImgError(true)}
          />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center font-semibold">
          {monogram || <User className={isPrint ? "h-4 w-4" : "h-6 w-6 opacity-60"} />}
        </div>
      )}
    </div>
  );
}
