"use client";

import { Check } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";
import type { KioskPlayer } from "@/lib/players/listPlayers";
import { KioskPlayerAvatar } from "./KioskPlayerAvatar";

const CARD_RADIUS = "12px";

type KioskWellnessPlayerCardProps = {
  player: KioskPlayer;
  hasSubmittedToday: boolean;
  onSelect: () => void;
};

export function KioskWellnessPlayerCard({
  player,
  hasSubmittedToday,
  onSelect,
}: KioskWellnessPlayerCardProps) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex h-40 max-h-40 min-h-40 w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl border px-2.5 py-3 text-center transition-colors min-[430px]:h-[11rem] min-[430px]:max-h-[11rem] min-[430px]:min-h-[11rem] min-[430px]:px-3 ${
        hasSubmittedToday
          ? "border-emerald-800/60 bg-emerald-950/20"
          : isHighContrast
            ? "border-white/15 hover:border-emerald-500/40 hover:bg-white/5"
            : "border-zinc-800/90 bg-zinc-900/50 hover:border-emerald-700/50 hover:bg-zinc-900/80"
      }`}
      style={{
        borderRadius: CARD_RADIUS,
        ...(themeId === "neon" ? NEON_CARD_STYLE : themeId === "matt" ? MATT_CARD_STYLE : {}),
      }}
    >
      <div className="flex min-h-0 w-full flex-col items-center justify-center gap-2.5 overflow-hidden">
        <KioskPlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size="card" />
        <span className="line-clamp-2 w-full px-0.5 text-base font-semibold leading-tight text-white min-[430px]:text-lg">
          {player.name}
        </span>
        {hasSubmittedToday ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-400 min-[430px]:text-sm">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Done today
          </span>
        ) : null}
      </div>
    </button>
  );
}
