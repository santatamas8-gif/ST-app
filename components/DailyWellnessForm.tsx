"use client";

import { useState, useMemo } from "react";
import { submitDailyWellness } from "@/app/actions/wellness";
import { sleepDurationHours } from "@/utils/sleep";

const FIELDS = [
  { key: "fatigue", label: "Fatigue (1–10)" },
  { key: "soreness", label: "Soreness (1–10)" },
  { key: "stress", label: "Stress (1–10)" },
  { key: "mood", label: "Mood (1–10)" },
] as const;

export function DailyWellnessForm() {
  const [bedTime, setBedTime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [sleepQuality, setSleepQuality] = useState(5);
  const [fatigue, setFatigue] = useState(5);
  const [soreness, setSoreness] = useState(5);
  const [stress, setStress] = useState(5);
  const [mood, setMood] = useState(5);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const sleepDuration = useMemo(() => {
    if (!bedTime || !wakeTime) return null;
    return sleepDurationHours(bedTime, wakeTime);
  }, [bedTime, wakeTime]);

  const values = { fatigue, soreness, stress, mood };
  const setters = {
    fatigue: setFatigue,
    soreness: setSoreness,
    stress: setStress,
    mood: setMood,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setIsSuccess(false);
    setLoading(true);
    const result = await submitDailyWellness({
      sleep_quality: sleepQuality,
      fatigue,
      soreness,
      stress,
      mood,
      bed_time: bedTime || undefined,
      wake_time: wakeTime || undefined,
    });
    setLoading(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setIsSuccess(true);
    setMessage("Daily wellness saved.");
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-lg">
      <h2 className="mb-4 text-lg font-semibold text-white">Daily wellness</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="bed_time" className="block text-sm font-medium text-zinc-300">
            Mikor feküdt le
          </label>
          <input
            id="bed_time"
            type="time"
            value={bedTime}
            onChange={(e) => setBedTime(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white"
          />
        </div>
        <div>
          <label htmlFor="wake_time" className="block text-sm font-medium text-zinc-300">
            Mikor kelt fel
          </label>
          <input
            id="wake_time"
            type="time"
            value={wakeTime}
            onChange={(e) => setWakeTime(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white"
          />
        </div>
        {sleepDuration !== null && (
          <p className="text-sm text-zinc-400">
            Alvás: <span className="font-medium text-white">{sleepDuration.toFixed(1)} óra</span>
          </p>
        )}
        <div>
          <label htmlFor="sleep_quality" className="block text-sm font-medium text-zinc-300">
            Alvás minőség (1–10)
          </label>
          <input
            id="sleep_quality"
            type="number"
            min={1}
            max={10}
            value={sleepQuality}
            onChange={(e) => setSleepQuality(Number(e.target.value))}
            required
            className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white"
          />
        </div>
        {FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label htmlFor={key} className="block text-sm font-medium text-zinc-300">
              {label}
            </label>
            <input
              id={key}
              type="number"
              min={1}
              max={10}
              value={values[key]}
              onChange={(e) => setters[key](Number(e.target.value))}
              required
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white"
            />
          </div>
        ))}
        {message && (
          <p
            className={
              isSuccess
                ? "text-sm text-emerald-400"
                : "text-sm text-red-400"
            }
          >
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {loading ? "Saving…" : "Submit"}
        </button>
      </form>
    </div>
  );
}
