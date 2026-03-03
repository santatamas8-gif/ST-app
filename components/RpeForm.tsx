"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";
import { submitSession } from "@/app/actions/sessions";
import { sessionLoad } from "@/utils/load";

const today = new Date().toISOString().slice(0, 10);
const CARD_BG = "var(--card-bg)";
const CARD_RADIUS = "12px";

// RPE: 1 = könnyű (zöld), 10 = nagyon nehéz (piros)
// Thumb szín: zöld → narancs → piros
function rpeThumbColor(value: number, min: number, max: number): string {
  const t = max === min ? 0 : (value - min) / (max - min);
  const green = { r: 22, g: 163, b: 74 };
  const orange = { r: 234, g: 88, b: 12 };
  const red = { r: 220, g: 38, b: 38 };
  let r: number;
  let g: number;
  let b: number;
  if (t <= 0.5) {
    const u = t * 2;
    r = Math.round(green.r + (orange.r - green.r) * u);
    g = Math.round(green.g + (orange.g - green.g) * u);
    b = Math.round(green.b + (orange.b - green.b) * u);
  } else {
    const u = (t - 0.5) * 2;
    r = Math.round(orange.r + (red.r - orange.r) * u);
    g = Math.round(orange.g + (red.g - orange.g) * u);
    b = Math.round(orange.b + (red.b - orange.b) * u);
  }
  return `rgb(${r},${g},${b})`;
}

interface RpeFormProps {
  hasSubmittedToday?: boolean;
}

export function RpeForm({ hasSubmittedToday = false }: RpeFormProps) {
  const router = useRouter();
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const [date, setDate] = useState(today);
  const [duration, setDuration] = useState("");
  const [rpe, setRpe] = useState(5);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const durationNum = duration ? parseInt(duration, 10) : 0;
  const load = durationNum > 0 && rpe >= 1 ? sessionLoad(durationNum, rpe) : null;
  const canSubmit = durationNum >= 1 && durationNum <= 300 && !loading;
  const rpeThumb = rpeThumbColor(rpe, 1, 10);
  const rpePercent = ((rpe - 1) / (10 - 1)) * 100;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!durationNum || durationNum < 1) {
      setError("Duration must be at least 1 minute.");
      return;
    }
    if (durationNum > 300) {
      setError("Duration must be at most 300 minutes.");
      return;
    }
    setLoading(true);
    const result = await submitSession({ date, duration: durationNum, rpe });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  if (success) {
    return (
      <div
        className={`rounded-xl border p-6 ${themeId === "neon" ? "neon-card-text border-emerald-500/40" : themeId === "matt" ? "matt-card-text border-white/20" : "border-emerald-800/50"}`}
        style={{
          borderRadius: CARD_RADIUS,
          ...(themeId === "neon" ? NEON_CARD_STYLE : themeId === "matt" ? MATT_CARD_STYLE : { backgroundColor: "rgba(16, 185, 129, 0.12)" }),
        }}
      >
        <p className="flex items-center gap-2 text-lg font-semibold text-emerald-400">
          <span>✔</span> Session saved
        </p>
        <p className={`mt-1 text-sm ${isHighContrast ? "text-white/80" : "text-zinc-400"}`}>Recent sessions below have been updated.</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border p-4 shadow-lg sm:p-6 ${themeId === "neon" ? "neon-card-text border-white/20" : themeId === "matt" ? "matt-card-text border-white/20" : "border-zinc-800"}`}
      style={{ borderRadius: CARD_RADIUS, ...(themeId === "neon" ? NEON_CARD_STYLE : themeId === "matt" ? MATT_CARD_STYLE : { backgroundColor: CARD_BG }) }}
    >
      {hasSubmittedToday && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2">
          <span className="text-emerald-400">✔</span>
          <span className="text-sm font-medium text-emerald-400">Session logged today</span>
        </div>
      )}
      <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-white">
        <Activity className="h-5 w-5 text-emerald-400" aria-hidden />
        Log session
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="rpe-date" className={`block text-sm font-medium ${isHighContrast ? "text-white/90" : "text-zinc-300"}`}>
            Date
          </label>
          <input
            id="rpe-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1.5 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label htmlFor="rpe-duration" className={`block text-sm font-medium ${isHighContrast ? "text-white/90" : "text-zinc-300"}`}>
            Session duration (minutes)
          </label>
          <input
            id="rpe-duration"
            type="number"
            min={1}
            max={300}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            required
            placeholder="e.g. 45"
            className="mt-1.5 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {load != null && (
          <div
            className="rounded-lg border border-emerald-500/20 px-4 py-3"
            style={{ backgroundColor: "rgba(16, 185, 129, 0.08)" }}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Calculated load</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
              {load}
            </p>
            <p className={`mt-0.5 text-xs ${isHighContrast ? "text-white/70" : "text-zinc-400"}`}>duration × RPE</p>
          </div>
        )}

        <div className={`rounded-xl px-4 py-5 sm:px-5 ${isHighContrast ? "bg-white/5" : "bg-zinc-800/60"}`} style={{ borderRadius: 10 }}>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" aria-hidden />
            <label htmlFor="rpe-slider" className={`text-sm font-medium ${isHighContrast ? "text-white/90" : "text-zinc-300"}`}>
              RPE (1–10)
            </label>
          </div>
          <p className={`mt-0.5 text-xs ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>
            How difficult was your session?
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className={`w-[4.5rem] shrink-0 text-xs ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>Very easy</span>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="relative h-6 w-full">
                <span
                  className="absolute top-0 whitespace-nowrap rounded-md bg-zinc-900/95 px-1.5 py-0.5 text-xs font-semibold tabular-nums"
                  style={{
                    left: `${rpePercent}%`,
                    transform: "translateX(-50%)",
                    color: rpeThumb,
                  }}
                  aria-live="polite"
                >
                  {rpe}
                </span>
              </div>
              <input
                id="rpe-slider"
                type="range"
                min={1}
                max={10}
                value={rpe}
                onChange={(e) => setRpe(Number(e.target.value))}
                className="scale-input-track rpe-input-track mt-1.5 h-2 w-full appearance-none rounded-full bg-transparent [--track-h:8px]"
                style={{ ["--thumb-color" as string]: rpeThumb }}
              />
            </div>
            <span className={`w-[4.5rem] shrink-0 text-right text-xs ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>Max effort</span>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2.5 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-xl bg-emerald-600 py-4 text-lg font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderRadius: CARD_RADIUS }}
        >
          {loading ? "Saving…" : "Save session"}
        </button>
      </form>
    </div>
  );
}
