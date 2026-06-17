"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Check } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";
import {
  getRpeButtonBaseClasses,
  getRpeButtonSelectedClasses,
  getRpeMeaning,
  MATCHDAY_TAGS,
  parseDurationInput,
  RPE_VALUES,
  SESSION_TYPES,
} from "@/lib/kioskRpe/constants";
import type { KioskPlayerSettingsPatch } from "@/lib/kioskRpe/state";
import type { KioskMatchdayTag, KioskSessionType, RpeValue } from "@/lib/kioskRpe/types";
import { sessionLoad } from "@/utils/load";

const CARD_RADIUS = "12px";

export type KioskPlayerRowSettings = {
  sessionType: KioskSessionType;
  matchdayTag: KioskMatchdayTag;
  duration: number;
};

interface KioskPlayerRowProps {
  playerId: string;
  name: string;
  avatarUrl: string | null;
  rpe: number | null;
  settings: KioskPlayerRowSettings;
  durationInput: string;
  isCompleted: boolean;
  readOnly?: boolean;
  onDurationInputChange: (value: string) => void;
  onSettingsChange: (patch: KioskPlayerSettingsPatch) => void;
  onRpeSelect: (rpe: RpeValue) => void;
}

function playerMonogram(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (parts[0][0] ?? "?").toUpperCase();
}

function PlayerAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [imgError, setImgError] = useState(false);
  const monogram = playerMonogram(name);
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const showImage = Boolean(avatarUrl) && !imgError;

  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-700 ring-2 ring-zinc-600 sm:h-11 sm:w-11">
      {showImage ? (
        // Native img keeps onError fallback for arbitrary Supabase avatar URLs (no next/image remote config).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl!}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center text-sm font-semibold sm:text-base ${isHighContrast ? "text-white/80" : "text-zinc-400"}`}
        >
          {monogram}
        </div>
      )}
    </div>
  );
}

function MetaChip({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-md border border-zinc-700/80 px-2 py-1 text-xs font-medium sm:text-sm ${isHighContrast ? "text-white/90" : "text-zinc-300"} ${className}`}
    >
      {children}
    </span>
  );
}

export function KioskPlayerRow({
  playerId,
  name,
  avatarUrl,
  rpe,
  settings,
  durationInput,
  isCompleted,
  readOnly = false,
  onDurationInputChange,
  onSettingsChange,
  onRpeSelect,
}: KioskPlayerRowProps) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";

  const durationInvalid = parseDurationInput(durationInput) === null;
  const parsedDuration = parseDurationInput(durationInput);
  const load =
    rpe !== null && parsedDuration !== null ? sessionLoad(parsedDuration, rpe) : null;
  const rpeMeaning = rpe !== null ? getRpeMeaning(rpe) : null;

  const cardStyle =
    themeId === "neon"
      ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
      : themeId === "matt"
        ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
        : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS };

  const selectClass =
    "h-9 min-w-[5.5rem] max-w-[7rem] rounded-lg border border-zinc-700 bg-zinc-800/80 px-2 text-xs text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:text-sm";
  const durationInputClass = durationInvalid
    ? "h-9 w-14 rounded-lg border border-red-600 bg-red-950/20 px-2 text-center text-xs text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm"
    : "h-9 w-14 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2 text-center text-xs text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:text-sm";

  const durationFieldId = `kiosk-player-duration-${playerId}`;
  const sessionTypeFieldId = `kiosk-player-session-type-${playerId}`;
  const matchdayFieldId = `kiosk-player-matchday-${playerId}`;

  return (
    <article
      className={`rounded-xl border border-zinc-800/90 p-3 sm:p-4 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
      style={cardStyle}
    >
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
        <div className="flex min-w-0 shrink-0 items-center gap-3 lg:w-36 xl:w-40">
          <PlayerAvatar name={name} avatarUrl={avatarUrl} />
          <p className="truncate font-semibold text-white">{name}</p>
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin]">
          <div
            className="flex w-max min-w-full items-center gap-1 sm:gap-1.5"
            role="group"
            aria-label={`RPE for ${name}`}
          >
            {RPE_VALUES.map((value) => {
              const selected = rpe === value;
              const meaning = getRpeMeaning(value);
              return (
                <button
                  key={value}
                  type="button"
                  disabled={readOnly}
                  aria-pressed={selected}
                  aria-label={`Set ${name} RPE to ${value} — ${meaning}`}
                  onClick={() => onRpeSelect(value)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm sm:h-10 sm:w-10 sm:text-base disabled:cursor-default disabled:opacity-100 ${
                    selected ? getRpeButtonSelectedClasses(value) : getRpeButtonBaseClasses(value)
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:shrink-0 lg:flex-nowrap">
          <MetaChip className={rpeMeaning ? "" : "text-zinc-500"}>
            {rpeMeaning ?? "—"}
          </MetaChip>

          <select
            id={sessionTypeFieldId}
            value={settings.sessionType}
            disabled={readOnly}
            onChange={(e) =>
              onSettingsChange({ sessionType: e.target.value as KioskSessionType })
            }
            className={selectClass}
            aria-label={`Session type for ${name}`}
          >
            {SESSION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            id={matchdayFieldId}
            value={settings.matchdayTag}
            disabled={readOnly}
            onChange={(e) =>
              onSettingsChange({ matchdayTag: e.target.value as KioskMatchdayTag })
            }
            className={selectClass}
            aria-label={`Matchday tag for ${name}`}
          >
            {MATCHDAY_TAGS.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>

          <div className="flex shrink-0 items-center gap-1">
            <input
              id={durationFieldId}
              type="number"
              min={1}
              max={300}
              step={1}
              inputMode="numeric"
              value={durationInput}
              disabled={readOnly}
              onChange={(e) => onDurationInputChange(e.target.value)}
              aria-label={`Duration in minutes for ${name}`}
              aria-invalid={durationInvalid}
              className={durationInputClass}
            />
            <span className={`text-xs sm:text-sm ${isHighContrast ? "text-white/70" : "text-zinc-400"}`}>
              min
            </span>
          </div>

          <MetaChip className="tabular-nums">
            {load !== null ? `${load} AU` : "—"}
          </MetaChip>

          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold sm:text-sm ${
              isCompleted
                ? "bg-emerald-500/20 text-emerald-400"
                : isHighContrast
                  ? "bg-zinc-700/50 text-zinc-300"
                  : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {isCompleted && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            {isCompleted ? "Completed" : "Missing"}
          </span>
        </div>
      </div>
    </article>
  );
}
