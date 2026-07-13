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

  const themeCardStyle =
    !hasSubmittedToday && isHighContrast
      ? themeId === "neon"
        ? NEON_CARD_STYLE
        : MATT_CARD_STYLE
      : {};

  return (
    <button
      type="button"
      disabled={hasSubmittedToday}
      onClick={hasSubmittedToday ? undefined : onSelect}
      aria-label={
        hasSubmittedToday ? `${player.name}, wellness already submitted today` : `Start wellness for ${player.name}`
      }
      className={`group flex h-40 max-h-40 min-h-40 w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl border px-2.5 py-3 text-center transition-colors min-[430px]:h-[11rem] min-[430px]:max-h-[11rem] min-[430px]:min-h-[11rem] min-[430px]:px-3 ${
        hasSubmittedToday
          ? "cursor-not-allowed border-emerald-900/35 bg-zinc-950/85 opacity-75"
          : isHighContrast
            ? "border-white/15 hover:border-emerald-500/40 hover:bg-white/5"
            : "border-zinc-800/90 bg-zinc-900/50 hover:border-emerald-700/50 hover:bg-zinc-900/80"
      }`}
      style={{
        borderRadius: CARD_RADIUS,
        ...themeCardStyle,
      }}
    >
      <div className="flex min-h-0 w-full flex-col items-center justify-center gap-2.5 overflow-hidden">
        <div className="relative shrink-0">
          <div className={hasSubmittedToday ? "opacity-40" : undefined}>
            <KioskPlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size="card" />
          </div>
          {hasSubmittedToday ? (
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              aria-hidden
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600/80 shadow-sm ring-2 ring-emerald-400/25 min-[430px]:h-9 min-[430px]:w-9">
                <Check className="h-4 w-4 text-white min-[430px]:h-[1.125rem] min-[430px]:w-[1.125rem]" strokeWidth={2.5} />
              </span>
            </span>
          ) : null}
        </div>
        <span
          className={`line-clamp-2 w-full px-0.5 text-base font-semibold leading-tight min-[430px]:text-lg ${
            hasSubmittedToday ? "text-zinc-500" : "text-white"
          }`}
        >
          {player.name}
        </span>
      </div>
    </button>
  );
}
