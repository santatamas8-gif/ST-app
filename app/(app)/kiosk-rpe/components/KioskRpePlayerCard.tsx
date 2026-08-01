"use client";

import { Check } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";
import type { KioskPlayer } from "@/lib/players/listPlayers";
import { KioskPlayerAvatar } from "./KioskPlayerAvatar";

const CARD_RADIUS = "12px";

type KioskRpePlayerCardProps = {
  player: KioskPlayer;
  isCompleted: boolean;
  rpe: number | null;
  muted?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

export function KioskRpePlayerCard({
  player,
  isCompleted,
  rpe,
  muted = false,
  disabled = false,
  onSelect,
}: KioskRpePlayerCardProps) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";

  const themeCardStyle =
    !isCompleted && isHighContrast
      ? themeId === "neon"
        ? NEON_CARD_STYLE
        : MATT_CARD_STYLE
      : {};

  const defaultSurface =
    isHighContrast
      ? "border-emerald-700/40 hover:border-emerald-500/50 hover:bg-white/5"
      : "border-emerald-800/45 bg-gradient-to-b from-emerald-950/40 via-slate-950/90 to-slate-950 hover:border-emerald-600/55";

  const completedSurface =
    "border-emerald-700/40 bg-emerald-950/25 hover:border-emerald-600/50";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onSelect}
      aria-label={
        isCompleted
          ? `${player.name}, RPE ${rpe ?? "selected"}, edit RPE`
          : `Select RPE for ${player.name}`
      }
      className={`group flex h-[10.5rem] max-h-[10.5rem] min-h-[10.5rem] w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl border px-2.5 py-2.5 text-center transition-colors min-[430px]:h-[11.5rem] min-[430px]:max-h-[11.5rem] min-[430px]:min-h-[11.5rem] min-[430px]:px-3 min-[430px]:py-3 ${
        disabled ? "cursor-not-allowed opacity-75" : "cursor-pointer"
      } ${muted && !isCompleted ? "opacity-75" : ""} ${
        isCompleted ? completedSurface : defaultSurface
      }`}
      style={{
        borderRadius: CARD_RADIUS,
        ...themeCardStyle,
      }}
    >
      <div className="flex min-h-0 w-full flex-col items-center justify-center gap-2 overflow-hidden">
        <div className="relative shrink-0">
          <div className={isCompleted ? "opacity-50" : undefined}>
            <KioskPlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size="card" />
          </div>
          {isCompleted ? (
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              aria-hidden
            >
              <span className="flex h-full w-full items-center justify-center rounded-full bg-emerald-500/45 shadow-sm ring-1 ring-emerald-400/20">
                <Check
                  className="h-8 w-8 text-emerald-50/90 min-[430px]:h-9 min-[430px]:w-9"
                  strokeWidth={2.5}
                />
              </span>
            </span>
          ) : null}
        </div>
        <span
          className={`line-clamp-2 w-full px-0.5 text-base font-semibold leading-tight min-[430px]:text-lg ${
            isCompleted ? "text-emerald-100/70 opacity-80" : "text-white"
          }`}
        >
          {player.name}
        </span>
        {isCompleted && rpe !== null ? (
          <span className="text-xs font-medium text-emerald-300/80 min-[430px]:text-sm">
            RPE {rpe}
          </span>
        ) : null}
      </div>
    </button>
  );
}
