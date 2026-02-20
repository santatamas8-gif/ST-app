"use client";

import { useState } from "react";
import { submitWellness } from "@/app/actions/wellness";
import { Card } from "@/components/Card";
import { ScaleInput } from "@/components/ScaleInput";
import { sleepDurationHours } from "@/utils/sleep";

const today = new Date().toISOString().slice(0, 10);

export function WellnessForm() {
  const [date, setDate] = useState(today);
  const [bedTime, setBedTime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [sleepQuality, setSleepQuality] = useState(5);
  const [soreness, setSoreness] = useState(5);
  const [fatigue, setFatigue] = useState(5);
  const [stress, setStress] = useState(5);
  const [mood, setMood] = useState(5);
  const [bodyweight, setBodyweight] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const sleepDuration =
    bedTime && wakeTime ? sleepDurationHours(bedTime, wakeTime) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    const result = await submitWellness({
      date,
      bed_time: bedTime,
      wake_time: wakeTime,
      sleep_quality: sleepQuality,
      soreness,
      fatigue,
      stress,
      mood,
      bodyweight: bodyweight ? parseFloat(bodyweight) : undefined,
    });
    setLoading(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "success", text: "Wellness entry saved." });
  }

  return (
    <Card title="Log wellness">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-zinc-300">
            Date
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1.5 block w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="bed_time" className="block text-sm font-medium text-zinc-300">
              Bed time
            </label>
            <input
              id="bed_time"
              type="time"
              value={bedTime}
              onChange={(e) => setBedTime(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="wake_time" className="block text-sm font-medium text-zinc-300">
              Wake time
            </label>
            <input
              id="wake_time"
              type="time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {sleepDuration != null && (
          <p className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-300">
            Sleep duration: <strong className="text-white">{sleepDuration.toFixed(1)} h</strong>
          </p>
        )}

        <div className="space-y-4">
          <ScaleInput label="Sleep quality (1–10)" value={sleepQuality} onChange={setSleepQuality} />
          <ScaleInput label="Muscle soreness" value={soreness} onChange={setSoreness} inverted />
          <ScaleInput label="Fatigue" value={fatigue} onChange={setFatigue} inverted />
          <ScaleInput label="Stress" value={stress} onChange={setStress} inverted />
          <ScaleInput label="Mood" value={mood} onChange={setMood} />
        </div>

        <div>
          <label htmlFor="bodyweight" className="block text-sm font-medium text-zinc-300">
            Bodyweight (optional, kg)
          </label>
          <input
            id="bodyweight"
            type="number"
            step="0.1"
            min="0"
            value={bodyweight}
            onChange={(e) => setBodyweight(e.target.value)}
            placeholder="e.g. 72.5"
            className="mt-1.5 block w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {message && (
          <p
            className={
              message.type === "error"
                ? "rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400"
                : "rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400"
            }
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save wellness"}
        </button>
      </form>
    </Card>
  );
}
