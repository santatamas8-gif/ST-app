"use client";

import { Settings2 } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";
import { MATCHDAY_TAGS, SESSION_TYPES } from "@/lib/kioskRpe/constants";
import type { KioskGlobalSettings } from "@/lib/kioskRpe/types";

const CARD_RADIUS = "12px";

type KioskGlobalSettingsProps = {
  settings: KioskGlobalSettings;
  durationInput: string;
  onSettingsChange: (settings: KioskGlobalSettings) => void;
  onDurationInputChange: (value: string) => void;
  onApplyAll: () => void;
  durationInvalid: boolean;
  applyAllDisabled: boolean;
  readOnly?: boolean;
};

export function KioskGlobalSettings({
  settings,
  durationInput,
  onSettingsChange,
  onDurationInputChange,
  onApplyAll,
  durationInvalid,
  applyAllDisabled,
  readOnly = false,
}: KioskGlobalSettingsProps) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";

  const cardStyle =
    themeId === "neon"
      ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
      : themeId === "matt"
        ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
        : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS };

  const labelClass = `block text-[11px] font-medium uppercase tracking-wide ${isHighContrast ? "text-white/70" : "text-zinc-500"}`;
  const inputClass =
    "mt-1 h-9 w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
  const invalidInputClass =
    "mt-1 h-9 w-full min-w-0 rounded-lg border border-red-600 bg-red-950/20 px-3 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

  return (
    <section
      className={`rounded-xl border border-zinc-800/90 p-3 sm:p-4 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
      style={cardStyle}
      aria-label="Global session settings"
    >
      <div className="mb-3 flex items-center gap-2">
        <Settings2 className="h-4 w-4 shrink-0 text-emerald-400 sm:h-5 sm:w-5" aria-hidden />
        <h2 className="text-sm font-semibold text-white sm:text-base">Global session settings</h2>
      </div>

      <div className="space-y-3">
        <div className="kiosk-global-fields grid gap-2 min-[500px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(5.5rem,0.65fr)]">
          <div className="min-w-0">
            <label htmlFor="kiosk-session-type" className={labelClass}>
              Session type
            </label>
            <select
              id="kiosk-session-type"
              value={settings.sessionType}
              disabled={readOnly}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  sessionType: e.target.value as KioskGlobalSettings["sessionType"],
                })
              }
              className={inputClass}
            >
              {SESSION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label htmlFor="kiosk-matchday-tag" className={labelClass}>
              Matchday tag
            </label>
            <select
              id="kiosk-matchday-tag"
              value={settings.matchdayTag}
              disabled={readOnly}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  matchdayTag: e.target.value as KioskGlobalSettings["matchdayTag"],
                })
              }
              className={inputClass}
            >
              {MATCHDAY_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label htmlFor="kiosk-duration" className={labelClass}>
              Duration (minutes)
            </label>
            <input
              id="kiosk-duration"
              type="number"
              min={1}
              max={300}
              step={1}
              inputMode="numeric"
              value={durationInput}
              disabled={readOnly}
              onChange={(e) => onDurationInputChange(e.target.value)}
              aria-invalid={durationInvalid}
              aria-describedby={durationInvalid ? "kiosk-duration-error" : undefined}
              className={durationInvalid ? invalidInputClass : inputClass}
            />
            {durationInvalid && (
              <p id="kiosk-duration-error" className="mt-1 text-xs text-red-400" role="alert">
                Duration must be between 1 and 300 minutes.
              </p>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <button
            type="button"
            onClick={onApplyAll}
            disabled={applyAllDisabled || readOnly}
            className="h-10 w-full rounded-lg border border-emerald-600 bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:border-emerald-800 disabled:bg-emerald-900/40 disabled:text-emerald-600"
            aria-disabled={applyAllDisabled}
          >
            Apply All
          </button>
        </div>
      </div>
    </section>
  );
}
