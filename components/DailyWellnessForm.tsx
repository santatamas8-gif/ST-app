"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { submitDailyWellness } from "@/app/actions/wellness";
import { sleepDurationHours } from "@/utils/sleep";
import { ScaleInput } from "@/components/ScaleInput";
import { BodyMap, type BodyPartsState } from "@/components/BodyMap";

const SCALE_HELPER = "1 = very bad, 10 = excellent";

const FIELDS = [
  { key: "fatigue", label: "Fatigue (1–10)", inverted: true },
  { key: "soreness", label: "Soreness (1–10)", inverted: true },
  { key: "stress", label: "Stress (1–10)", inverted: true },
  { key: "mood", label: "Mood (1–10)", inverted: false },
  { key: "motivation", label: "Motivation (1–10)", inverted: false },
] as const;

interface DailyWellnessFormProps {
  hasSubmittedToday?: boolean;
}

export function DailyWellnessForm({ hasSubmittedToday = false }: DailyWellnessFormProps) {
  const [bedTime, setBedTime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [sleepQuality, setSleepQuality] = useState(5);
  const [fatigue, setFatigue] = useState(5);
  const [soreness, setSoreness] = useState(5);
  const [stress, setStress] = useState(5);
  const [mood, setMood] = useState(5);
  const [motivation, setMotivation] = useState(5);
  const [illness, setIllness] = useState(false);
  const [bodyParts, setBodyParts] = useState<BodyPartsState>({});
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const sleepDuration = useMemo(() => {
    if (!bedTime || !wakeTime) return null;
    return sleepDurationHours(bedTime, wakeTime);
  }, [bedTime, wakeTime]);

  const values = { fatigue, soreness, stress, mood, motivation };
  const setters = {
    fatigue: setFatigue,
    soreness: setSoreness,
    stress: setStress,
    mood: setMood,
    motivation: setMotivation,
  };

  const allScalesValid =
    sleepQuality >= 1 &&
    sleepQuality <= 10 &&
    values.fatigue >= 1 &&
    values.fatigue <= 10 &&
    values.soreness >= 1 &&
    values.soreness <= 10 &&
    values.stress >= 1 &&
    values.stress <= 10 &&
    values.mood >= 1 &&
    values.mood <= 10 &&
    values.motivation >= 1 &&
    values.motivation <= 10;
  const canSubmit = allScalesValid && !loading && !hasSubmittedToday;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setIsSuccess(false);
    setLoading(true);
    const bodyPartsForDb =
      Object.keys(bodyParts).length > 0
        ? Object.fromEntries(
            Object.entries(bodyParts).map(([id, v]) => [
              id,
              { s: v.soreness || 0, p: v.pain || 0 },
            ])
          )
        : undefined;
    const result = await submitDailyWellness({
      sleep_quality: sleepQuality,
      fatigue,
      soreness,
      stress,
      mood,
      motivation,
      illness,
      bed_time: bedTime || undefined,
      wake_time: wakeTime || undefined,
      body_parts: bodyPartsForDb,
    });
    setLoading(false);
    if (result.error) {
      setSubmitError(result.error);
      return;
    }
    setIsSuccess(true);
  }

  if (hasSubmittedToday) {
    return (
      <div
        className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-5"
        style={{ borderRadius: 12 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl text-emerald-400">✔</span>
          <div>
            <p className="font-semibold text-emerald-400">Already submitted today</p>
            <p className="mt-0.5 text-sm text-zinc-400">You can submit again tomorrow.</p>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="mt-4 inline-block rounded-lg bg-zinc-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-600"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div
        className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-6"
        style={{ borderRadius: 12 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl text-emerald-400">✔</span>
          <p className="text-lg font-semibold text-emerald-400">Wellness submitted</p>
        </div>
        <p className="mt-2 text-sm text-zinc-400">Thanks! Your daily check-in is saved.</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border p-5 shadow-lg"
      style={{ backgroundColor: "var(--card-bg)", borderRadius: 12, borderColor: "var(--card-border)" }}
    >
      <h2 className="mb-1 text-lg font-semibold text-white">Daily wellness</h2>
      <p className="mb-4 text-sm text-zinc-400">{SCALE_HELPER}</p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="bed_time" className="block text-sm font-medium text-zinc-300">
            Bed time
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
            Wake time
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
            Sleep: <span className="font-medium text-white">{sleepDuration.toFixed(1)} h</span>
          </p>
        )}
        <div>
          <ScaleInput
            id="sleep_quality"
            label="Sleep quality (1–10)"
            value={sleepQuality}
            onChange={setSleepQuality}
            min={1}
            max={10}
          />
        </div>
        {FIELDS.map(({ key, label, inverted }) => (
          <div key={key}>
            <ScaleInput
              id={key}
              label={label}
              value={values[key]}
              onChange={setters[key]}
              min={1}
              max={10}
              inverted={inverted}
            />
          </div>
        ))}
        <div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-300">
            <input
              type="checkbox"
              checked={illness}
              onChange={(e) => setIllness(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-red-500 focus:ring-red-500"
            />
            Illness today (e.g. cold, fever, stomach)
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300">
            Body map – soreness & pain (optional)
          </label>
          <p className="mt-0.5 mb-2 text-xs text-zinc-500">
            Tap body parts to add soreness or pain level (1–10). Switch view for front/back.
          </p>
          <BodyMap value={bodyParts} onChange={setBodyParts} />
        </div>
        {submitError && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">
            {submitError}
          </div>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Saving…" : "Submit"}
        </button>
      </form>
    </div>
  );
}
