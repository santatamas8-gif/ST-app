"use client";

import { Check } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";
import type { KioskPlayer } from "@/lib/players/listPlayers";
import { KioskPlayerAvatar } from "./KioskPlayerAvatar";

const CARD_RADIUS = "12px";

type KioskMatchPlayerCardProps = {
  player: KioskPlayer;
  completed: boolean;
  onSelect: () => void;
};

/** Match-specific card: completed cards remain tappable for Update Response. */
export function KioskMatchPlayerCard({ player, completed, onSelect }: KioskMatchPlayerCardProps) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";

  const themeCardStyle =
    isHighContrast
      ? themeId === "neon"
        ? NEON_CARD_STYLE
        : MATT_CARD_STYLE
      : {};

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={
        completed
          ? `${player.name}, completed — tap to update response`
          : `Open match feedback for ${player.name}`
      }
      className={`group flex h-40 max-h-40 min-h-40 w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl border px-2.5 py-3 text-center transition-colors min-[430px]:h-[11rem] min-[430px]:max-h-[11rem] min-[430px]:min-h-[11rem] min-[430px]:px-3 ${
        completed
          ? isHighContrast
            ? "border-emerald-500/40 hover:border-emerald-400/50 hover:bg-white/5"
            : "border-emerald-800/50 bg-zinc-900/60 hover:border-emerald-600/60"
          : isHighContrast
            ? "border-white/15 hover:border-emerald-500/40 hover:bg-white/5"
            : "border-zinc-800/90 bg-zinc-900/50 hover:border-emerald-700/50 hover:bg-zinc-900/80"
      }`}
      style={{ borderRadius: CARD_RADIUS, ...themeCardStyle }}
    >
      <div className="flex min-h-0 w-full flex-col items-center justify-center gap-2.5 overflow-hidden">
        <div className="relative shrink-0">
          <div className={completed ? "opacity-50" : undefined}>
            <KioskPlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size="card" />
          </div>
          {completed ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
              <span className="flex h-full w-full items-center justify-center rounded-full bg-emerald-500/45 shadow-sm ring-1 ring-emerald-400/20">
                <Check
                  className="h-8 w-8 text-emerald-50/90 min-[430px]:h-9 min-[430px]:w-9"
                  strokeWidth={2.5}
                />
              </span>
            </span>
          ) : null}
        </div>
        <span className="line-clamp-2 w-full px-0.5 text-base font-semibold leading-tight text-white min-[430px]:text-lg">
          {player.name}
        </span>
        <span
          className={`text-xs font-medium uppercase tracking-wide ${
            completed ? "text-emerald-400" : isHighContrast ? "text-amber-300" : "text-zinc-500"
          }`}
        >
          {completed ? "Completed" : "Missing"}
        </span>
      </div>
    </button>
  );
}
