"use client";

import { useState } from "react";
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
  className?: string;
}

export function PlayerAvatar({
  name,
  avatarUrl,
  variant = "screen",
  className = "",
}: PlayerAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const url = (avatarUrl ?? "").trim();
  const showImage = Boolean(url) && !imgError;
  const monogram = playerMonogram(name);
  const isPrint = variant === "print";

  const sizeClass = isPrint
    ? "player-avatar-print h-[22mm] w-[22mm] text-[11pt]"
    : "h-16 w-16 text-base sm:h-[4.5rem] sm:w-[4.5rem] sm:text-lg";

  const shellClass = isPrint
    ? "rounded-full border border-neutral-300 bg-neutral-100 text-neutral-600"
    : "rounded-full bg-zinc-700 ring-2 ring-zinc-600 text-zinc-300";

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${sizeClass} ${shellClass} ${className}`}
      aria-hidden={!name}
    >
      {showImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            className="h-full w-full object-cover"
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
