"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Check } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";
import {
  getRpeButtonBaseClasses,
  getRpeButtonSelectedClasses,
  getRpeIntensityBand,
  getRpeMeaning,
  MATCHDAY_TAGS,
  parseDurationInput,
  RPE_VALUES,
  SESSION_TYPES,
} from "@/lib/kioskRpe/constants";
import type { KioskPlayerSettingsPatch } from "@/lib/kioskRpe/state";
import type { KioskMatchdayTag, KioskSessionType, RpeValue } from "@/lib/kioskRpe/types";

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
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-700 ring-2 ring-zinc-600 min-[430px]:h-11 min-[430px]:w-11">
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
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-zinc-700/80 px-2 py-1 text-xs font-medium sm:text-sm ${isHighContrast ? "text-white/90" : "text-zinc-300"} ${className}`}
    >
      {children}
    </span>
  );
}

function getRpeMeaningBadgeClasses(rpe: number | null): string {
  if (rpe === null) {
    return "!border-zinc-700/80 !bg-zinc-800/40 text-zinc-500";
  }

  switch (getRpeIntensityBand(rpe)) {
    case "easy":
      return "!border-emerald-600/70 !bg-emerald-950/50 text-emerald-300";
    case "moderate":
      return "!border-lime-600/70 !bg-lime-950/45 text-lime-300";
    case "hard":
      return "!border-orange-600/70 !bg-orange-950/45 text-orange-300";
    case "very-hard":
      return "!border-orange-700/80 !bg-orange-950/60 text-orange-200";
    case "extreme":
      return "!border-red-600/80 !bg-red-950/55 text-red-300";
    case "maximal":
      return "!border-red-900 !bg-red-950/80 text-red-200";
  }
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
  const rpeMeaning = rpe !== null ? getRpeMeaning(rpe) : null;

  const cardStyle =
    themeId === "neon"
      ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
      : themeId === "matt"
        ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
        : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS };

  const sessionSelectClass =
    "h-8 w-[6.25rem] max-w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:w-[7rem]";
  const matchdaySelectClass =
    "h-8 w-[5rem] max-w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:w-[5.75rem]";
  const durationInputClass = durationInvalid
    ? "h-8 w-14 rounded-lg border border-red-600 bg-red-950/20 px-1.5 text-center text-xs text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
    : "h-8 w-14 rounded-lg border border-zinc-700 bg-zinc-800/80 px-1.5 text-center text-xs text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  const durationFieldId = `kiosk-player-duration-${playerId}`;
  const sessionTypeFieldId = `kiosk-player-session-type-${playerId}`;
  const matchdayFieldId = `kiosk-player-matchday-${playerId}`;

  return (
    <article
      className={`rounded-xl border border-zinc-800/90 p-2.5 sm:p-3 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
      style={cardStyle}
    >
      <div className="kiosk-player-grid grid min-w-0 grid-cols-[40px_minmax(0,1fr)] gap-x-2 gap-y-2 min-[430px]:grid-cols-[44px_minmax(0,8rem)_minmax(0,1fr)_5.5rem] min-[430px]:items-center sm:grid-cols-[44px_minmax(0,9.5rem)_minmax(0,1fr)_6rem] xl:grid-cols-[44px_minmax(0,11.5rem)_minmax(0,1fr)_6.5rem] xl:gap-x-3">
        <div className="col-start-1 row-start-1">
          <PlayerAvatar name={name} avatarUrl={avatarUrl} />
        </div>

        <div className="col-start-2 row-start-1 min-w-0">
          <p className="truncate text-[15px] font-semibold text-white min-[430px]:text-base" title={name}>
            {name}
          </p>
        </div>

        <div className="kiosk-rpe-cell col-span-2 row-start-2 min-w-0 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] min-[430px]:col-start-3 min-[430px]:col-end-4 min-[430px]:row-start-1">
          <div
            className="kiosk-rpe-buttons flex w-max min-w-full items-center gap-1 min-[430px]:gap-0.5 sm:gap-1"
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
                  className={`kiosk-rpe-button flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-medium disabled:cursor-default disabled:opacity-100 min-[430px]:h-8 min-[430px]:w-8 ${
                    selected ? getRpeButtonSelectedClasses(value) : getRpeButtonBaseClasses(value)
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>

        <MetaChip
          className={`kiosk-meaning-cell col-span-2 row-start-3 w-fit justify-center whitespace-nowrap px-1 text-center text-[10px] leading-tight min-[430px]:col-start-4 min-[430px]:col-end-5 min-[430px]:row-start-1 min-[430px]:w-full min-[430px]:text-[10px] sm:text-[11px] ${getRpeMeaningBadgeClasses(rpe)}`}
        >
          {rpeMeaning ?? "—"}
        </MetaChip>

        <div className="kiosk-player-controls-cell col-span-2 row-start-4 flex min-w-0 flex-wrap items-center gap-1.5 border-t border-zinc-800/80 pt-2 min-[430px]:col-start-3 min-[430px]:col-end-4 min-[430px]:row-start-2 min-[430px]:border-t-0 min-[430px]:pt-0">
          <select
            id={sessionTypeFieldId}
            value={settings.sessionType}
            disabled={readOnly}
            onChange={(e) =>
              onSettingsChange({ sessionType: e.target.value as KioskSessionType })
            }
            className={sessionSelectClass}
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
            className={matchdaySelectClass}
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
            <span className={`text-xs ${isHighContrast ? "text-white/70" : "text-zinc-400"}`}>
              min
            </span>
          </div>
        </div>

        <span
          className={`kiosk-status-cell col-span-2 row-start-5 inline-flex min-h-8 w-fit shrink-0 items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 text-[10px] font-semibold leading-tight min-[430px]:col-start-4 min-[430px]:col-end-5 min-[430px]:row-start-2 min-[430px]:w-full sm:px-2 sm:text-[11px] ${
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
    </article>
  );
}
