"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitSession } from "@/app/actions/sessions";
import { sessionLoad } from "@/utils/load";

const today = new Date().toISOString().slice(0, 10);
const CARD_BG = "#11161c";
const CARD_RADIUS = "12px";

interface RpeFormProps {
  hasSubmittedToday?: boolean;
}

export function RpeForm({ hasSubmittedToday = false }: RpeFormProps) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [duration, setDuration] = useState("");
  const [rpe, setRpe] = useState(5);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const durationNum = duration ? parseInt(duration, 10) : 0;
  const load = durationNum > 0 && rpe >= 1 ? sessionLoad(durationNum, rpe) : null;
  const canSubmit = durationNum >= 1 && durationNum <= 300 && !loading;

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
        className="rounded-xl border border-emerald-800/50 p-6"
        style={{ backgroundColor: "rgba(16, 185, 129, 0.12)", borderRadius: CARD_RADIUS }}
      >
        <p className="flex items-center gap-2 text-lg font-semibold text-emerald-400">
          <span>✔</span> Session saved
        </p>
        <p className="mt-1 text-sm text-zinc-400">Recent sessions below have been updated.</p>
        <button
          type="button"
          onClick={() => { setSuccess(false); setDuration(""); }}
          className="mt-4 rounded-lg bg-zinc-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-600"
        >
          Log another
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-zinc-800 p-4 shadow-lg sm:p-6"
      style={{ backgroundColor: CARD_BG, borderRadius: CARD_RADIUS }}
    >
      {hasSubmittedToday && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2">
          <span className="text-emerald-400">✔</span>
          <span className="text-sm font-medium text-emerald-400">Session logged today</span>
        </div>
      )}
      <h2 className="mb-5 text-lg font-semibold text-white">Log session</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="rpe-date" className="block text-sm font-medium text-zinc-300">
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
          <label htmlFor="rpe-duration" className="block text-sm font-medium text-zinc-300">
            Session duration (minutes)
          </label>
          <p className="mt-0.5 text-xs text-zinc-500">1–300 minutes</p>
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

        <div className="rounded-xl bg-zinc-800/60 px-4 py-5 sm:px-5" style={{ borderRadius: 10 }}>
          <div className="flex items-baseline justify-between">
            <label htmlFor="rpe-slider" className="text-sm font-medium text-zinc-300">
              RPE (1–10)
            </label>
            <span className="text-4xl font-bold tabular-nums text-white">{rpe}</span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">1 = very easy, 10 = max effort</p>
          <input
            id="rpe-slider"
            type="range"
            min={1}
            max={10}
            value={rpe}
            onChange={(e) => setRpe(Number(e.target.value))}
            className="mt-3 h-4 w-full appearance-none rounded-full bg-zinc-600 accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-xs text-zinc-500">
            <span>Very light</span>
            <span>Max</span>
          </div>
        </div>

        {load != null && (
          <div
            className="rounded-lg border border-emerald-500/20 px-4 py-3"
            style={{ backgroundColor: "rgba(16, 185, 129, 0.08)" }}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Calculated load</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">
              {load} <span className="text-sm font-normal text-zinc-400">(duration × RPE)</span>
            </p>
          </div>
        )}

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
