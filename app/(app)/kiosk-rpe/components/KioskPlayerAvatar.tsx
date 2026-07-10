"use client";

import { useState } from "react";
import { PROFILE_AVATAR_BG_CLASS } from "@/lib/players/profileAvatarStyles";
import { useTheme } from "@/components/ThemeProvider";

function playerMonogram(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (parts[0][0] ?? "?").toUpperCase();
}

const SIZE_CLASSES = {
  card: "h-16 w-16 text-base min-[430px]:h-[4.75rem] min-[430px]:w-[4.75rem] min-[430px]:text-lg",
  gate: "h-24 w-24 text-xl min-[430px]:h-28 min-[430px]:w-28 min-[430px]:text-2xl",
} as const;

type KioskPlayerAvatarProps = {
  name: string;
  avatarUrl: string | null;
  size?: keyof typeof SIZE_CLASSES;
};

export function KioskPlayerAvatar({ name, avatarUrl, size = "card" }: KioskPlayerAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const monogram = playerMonogram(name);
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const showImage = Boolean(avatarUrl) && !imgError;
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div
      className={`${sizeClass} relative shrink-0 overflow-hidden rounded-full bg-zinc-700 ring-2 ${
        isHighContrast ? "ring-white/20" : "ring-zinc-600"
      }`}
    >
      {showImage ? (
        <>
          <div
            className={PROFILE_AVATAR_BG_CLASS}
            style={{ backgroundImage: `url(${avatarUrl})` }}
            role="img"
            aria-label={name}
          />
          {/* Hidden probe so broken URLs fall back to initials. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl!}
            alt=""
            className="hidden"
            onError={() => setImgError(true)}
          />
        </>
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center font-semibold ${
            isHighContrast ? "text-white/80" : "text-zinc-300"
          }`}
        >
          {monogram}
        </div>
      )}
    </div>
  );
}
