"use client";

import { PROFILE_AVATAR_IMG_CLASS } from "@/lib/players/profileAvatarStyles";
import { useState, type ReactNode } from "react";
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
  rpeReadOnly?: boolean;
  muted?: boolean;
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
          className={PROFILE_AVATAR_IMG_CLASS}
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
  rpeReadOnly = false,
  muted = false,
  onDurationInputChange,
  onSettingsChange,
  onRpeSelect,
}: KioskPlayerRowProps) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";

  const durationInvalid = parseDurationInput(durationInput) === null;
  const rpeMeaning = rpe !== null ? getRpeMeaning(rpe) : null;
  const parsedDuration = parseDurationInput(durationInput);
  const loadPreview =
    rpe !== null && parsedDuration !== null ? sessionLoad(parsedDuration, rpe) : null;
  const rpeButtonsDisabled = readOnly || rpeReadOnly;

  const cardStyle =
    themeId === "neon"
      ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
      : themeId === "matt"
        ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
        : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS };

  const sessionSelectClass =
    "kiosk-row-select h-8 w-[6.5rem] rounded-lg border border-zinc-700 bg-zinc-800/80 px-2 text-xs text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
  const matchdaySelectClass =
    "kiosk-row-select h-8 w-[5.75rem] rounded-lg border border-zinc-700 bg-zinc-800/80 px-2 text-xs text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
  const durationInputClass = durationInvalid
    ? "kiosk-row-duration h-8 w-14 rounded-lg border border-red-600 bg-red-950/20 px-1.5 text-center text-xs text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
    : "kiosk-row-duration h-8 w-14 rounded-lg border border-zinc-700 bg-zinc-800/80 px-1.5 text-center text-xs text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  const durationFieldId = `kiosk-player-duration-${playerId}`;
  const sessionTypeFieldId = `kiosk-player-session-type-${playerId}`;
  const matchdayFieldId = `kiosk-player-matchday-${playerId}`;

  return (
    <article
      className={`kiosk-player-row-card rounded-xl border border-zinc-800/90 p-2.5 transition-opacity sm:p-3 ${muted ? "opacity-75" : ""} ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
      style={cardStyle}
    >
      <div className="kiosk-player-row-line flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="kiosk-player-fixed flex min-w-0 shrink-0 basis-[13rem] items-center gap-2 min-[430px]:basis-[15rem] sm:basis-[16rem] xl:basis-[18rem]">
          <PlayerAvatar name={name} avatarUrl={avatarUrl} />
          <p className="kiosk-player-name truncate text-[15px] font-semibold text-white min-[430px]:text-base" title={name}>
            {name}
          </p>
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="min-w-0 overflow-x-auto pb-0.5 pr-5 [-ms-overflow-style:none] [scrollbar-width:thin] lg:pr-0">
            <div className="kiosk-row-scroll-content flex w-max min-w-full items-center gap-1.5 sm:gap-2">
              <div
                className="flex shrink-0 items-center gap-1"
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
                      disabled={rpeButtonsDisabled}
                      aria-pressed={selected}
                      aria-label={`Set ${name} RPE to ${value} — ${meaning}`}
                      onClick={() => onRpeSelect(value)}
                      className={`kiosk-row-rpe-button flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-medium disabled:cursor-default disabled:opacity-100 ${
                        selected ? getRpeButtonSelectedClasses(value) : getRpeButtonBaseClasses(value)
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>

              <MetaChip
                className={`kiosk-row-meaning min-h-8 min-w-[6.75rem] justify-center px-2 text-center text-[11px] leading-tight ${getRpeMeaningBadgeClasses(rpe)}`}
              >
                {rpeMeaning ?? "—"}
              </MetaChip>

              <span
                className={`kiosk-row-status inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  isCompleted
                    ? "bg-emerald-500/20 text-emerald-400"
                    : isHighContrast
                      ? "bg-zinc-700/50 text-zinc-300"
                      : "bg-zinc-800 text-zinc-400"
                }`}
                aria-label={isCompleted ? `${name} completed` : `${name} missing`}
                title={isCompleted ? "Completed" : "Missing"}
              >
                {isCompleted ? <Check className="h-4 w-4" aria-hidden /> : "–"}
              </span>

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

              <div className="flex shrink-0 items-center gap-1 pr-1">
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
                <span className={`kiosk-row-min-label text-xs ${isHighContrast ? "text-white/70" : "text-zinc-400"}`}>
                  min
                </span>
              </div>

              <MetaChip className="kiosk-row-load min-h-8 min-w-[5.5rem] justify-center border-teal-700/70 bg-teal-950/35 px-2 text-center text-[11px] text-teal-300">
                {loadPreview === null ? "— AU" : `${Math.round(loadPreview)} AU`}
              </MetaChip>
            </div>
          </div>
          <div
            className="pointer-events-none absolute bottom-0 right-0 top-0 w-8 bg-gradient-to-l from-[#020617] via-[#020617]/70 to-transparent lg:hidden"
            aria-hidden
          />
        </div>
      </div>
    </article>
  );
}
