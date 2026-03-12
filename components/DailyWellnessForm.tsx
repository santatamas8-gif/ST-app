"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo, useEffect, useRef } from "react";
import { submitDailyWellness } from "@/app/actions/wellness";
import { sleepDurationHours, formatSleepDuration } from "@/utils/sleep";
import { ScaleInput } from "@/components/ScaleInput";
import { BodyMap, type BodyPartsState } from "@/components/BodyMap";
import { HeartPulse, Moon, Activity, Brain, MoreHorizontal, Pill, Check } from "lucide-react";

const FIELDS = [
  {
    key: "fatigue",
    label: "How much energy do you have? (fatigue)",
    lowLabel: "No energy",
    highLabel: "Full of energy",
    invertOnSubmit: false,
  },
  {
    key: "soreness",
    label: "How recovered do your muscles feel? (soreness)",
    lowLabel: "Very sore",
    highLabel: "Fully recovered",
    invertOnSubmit: false,
  },
  {
    key: "stress",
    label: "How stressed are you?",
    lowLabel: "Very stressed",
    highLabel: "Not stressed at all",
    invertOnSubmit: false,
  },
  {
    key: "mood",
    label: "Mood (1–10)",
    lowLabel: "Very bad",
    highLabel: "Excellent",
    invertOnSubmit: false,
  },
] as const;

interface DailyWellnessFormProps {
  hasSubmittedToday?: boolean;
}

export function DailyWellnessForm({ hasSubmittedToday = false }: DailyWellnessFormProps) {
  const router = useRouter();
  const [bedTime, setBedTime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [sleepQuality, setSleepQuality] = useState(5);
  const [fatigue, setFatigue] = useState(5);
  const [soreness, setSoreness] = useState(5);
  const [stress, setStress] = useState(5);
  const [mood, setMood] = useState(5);
  const [illness, setIllness] = useState(false);
  const [bodyParts, setBodyParts] = useState<BodyPartsState>({});
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const submittedBlockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const set = () => setIsMobile(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

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
    values.mood <= 10;
  const allRequiredFilled = bedTime.trim() !== "" && wakeTime.trim() !== "" && allScalesValid;
  const canSubmit = allRequiredFilled && !loading && !hasSubmittedToday;

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
    router.refresh(); // refetch page data so chart and list show the new entry
  }

  // After successful submit, scroll to the success block (not down to averages)
  useEffect(() => {
    if (!isSuccess) return;
    const t = requestAnimationFrame(() => {
      submittedBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(t);
  }, [isSuccess]);

  if (hasSubmittedToday) {
    return (
      <div
        ref={submittedBlockRef}
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
        ref={submittedBlockRef}
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
      className="wellness-player-form rounded-xl border shadow-lg overflow-hidden"
      style={{ backgroundColor: "var(--card-bg)", borderRadius: 12, borderColor: "var(--card-border)" }}
    >
      <header className="border-b border-zinc-700/80 bg-emerald-950/25 px-4 py-3.5 md:px-5 md:py-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white md:text-lg">
          <HeartPulse className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
          Daily wellness
        </h2>
      </header>
      <form onSubmit={handleSubmit} className="min-w-0 space-y-4 p-3 md:space-y-6 md:p-5">
        {/* Sleep */}
        <div className="min-w-0 space-y-4 rounded-xl border border-zinc-700/50 bg-slate-900/25 py-4 px-3 md:space-y-4 md:px-4 md:pb-4 md:pt-4">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:text-sm">
            <Moon className="h-4 w-4 shrink-0" aria-hidden />
            Sleep
          </h3>
          <div className="space-y-6 pl-0 md:space-y-4">
            <div>
              <label htmlFor="bed_time" className="block text-sm font-medium text-zinc-300">
                Bed time
              </label>
              <input
                id="bed_time"
                type="time"
                value={bedTime}
                onChange={(e) => setBedTime(e.target.value)}
                className="mt-1 block min-h-[48px] w-full max-w-[10rem] rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-3 text-base text-white [color-scheme:dark]"
                aria-label="Bed time"
              />
            </div>
            <div>
              <label htmlFor="wake_time" className="block text-sm font-medium text-zinc-300">
                Wake up time
              </label>
              <input
                id="wake_time"
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className="mt-1 block min-h-[48px] w-full max-w-[10rem] rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-3 text-base text-white [color-scheme:dark]"
                aria-label="Wake up time"
              />
            </div>
            {sleepDuration !== null && (
              <p className="text-sm text-zinc-400">
                Sleep: <span className="font-medium text-white">{formatSleepDuration(sleepDuration)} h</span>
              </p>
            )}
            <ScaleInput
              id="sleep_quality"
              label="Sleep quality"
              lowLabel="Very poor"
              highLabel="Excellent"
              value={sleepQuality}
              onChange={setSleepQuality}
              min={1}
              max={10}
            />
          </div>
        </div>

        {/* Body */}
        <div className="min-w-0 space-y-4 rounded-xl border border-zinc-700/50 bg-amber-950/20 py-4 px-3 md:space-y-4 md:border-0 md:border-t md:border-zinc-700/80 md:px-4 md:pb-4 md:pt-6">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:text-sm">
            <Activity className="h-4 w-4 shrink-0" aria-hidden />
            Body
          </h3>
          <div className="space-y-6 pl-0 md:space-y-4">
            {FIELDS.filter((f) => f.key === "fatigue" || f.key === "soreness").map(({ key, label, lowLabel, highLabel }) => (
              <ScaleInput
                key={key}
                id={key}
                label={label}
                lowLabel={lowLabel}
                highLabel={highLabel}
                value={values[key]}
                onChange={setters[key]}
                min={1}
                max={10}
              />
            ))}
          </div>
        </div>

        {/* Mind */}
        <div className="min-w-0 space-y-4 rounded-xl border border-zinc-700/50 bg-violet-950/20 py-4 px-3 md:space-y-4 md:border-0 md:border-t md:border-zinc-700/80 md:px-4 md:pb-4 md:pt-6">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:text-sm">
            <Brain className="h-4 w-4 shrink-0" aria-hidden />
            Mind
          </h3>
          <div className="space-y-6 pl-0 md:space-y-4">
            {FIELDS.filter((f) => f.key === "stress" || f.key === "mood").map(({ key, label, lowLabel, highLabel }) => (
              <ScaleInput
                key={key}
                id={key}
                label={label}
                lowLabel={lowLabel}
                highLabel={highLabel}
                value={values[key]}
                onChange={setters[key]}
                min={1}
                max={10}
              />
            ))}
          </div>
        </div>

        <div className="min-w-0 space-y-4 rounded-xl border py-4 px-3 md:space-y-4 md:border-0 md:border-t md:px-4 md:pb-4 md:pt-6" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide md:text-sm" style={{ color: "var(--foreground)" }}>
            <MoreHorizontal className="h-4 w-4 shrink-0" aria-hidden />
            Other
          </h3>
          <div className="rounded-xl border p-3 md:p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              <Pill className="h-5 w-5 text-amber-500/90" aria-hidden />
              Illness today (e.g. cold, fever, stomach)
            </p>
            <div className="flex gap-2" role="group" aria-label="Illness today">
              <button
                type="button"
                onClick={() => setIllness(false)}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  !illness
                    ? "bg-emerald-600 text-white hover:bg-emerald-500"
                    : "bg-zinc-700/60 text-zinc-400 hover:bg-zinc-600"
                }`}
              >
                {!illness && <Check className="h-4 w-4" aria-hidden />}
                No
              </button>
              <button
                type="button"
                onClick={() => setIllness(true)}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  illness
                    ? "bg-red-600/90 text-white"
                    : "bg-zinc-700/60 text-zinc-400 hover:bg-zinc-600"
                }`}
              >
                {illness && <Check className="h-4 w-4" aria-hidden />}
                Yes
              </button>
            </div>
            <p className="mt-1 text-xs opacity-80" style={{ color: "var(--foreground)" }}>Default is No — only tap Yes if you have illness.</p>
          </div>
          <div className="mt-3 min-w-0 overflow-hidden rounded-xl border-t p-3 pt-3 md:mt-4 md:overflow-visible md:p-4 md:pt-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <label className="block text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              Body map – soreness & pain (optional)
            </label>
            <p className="mt-0.5 mb-2 text-xs opacity-80" style={{ color: "var(--foreground)" }}>
              Tap a body part to set level (1–10).<span className="hidden sm:inline"> Use FRONT/BACK to switch side.</span>
            </p>
            <div className="flex min-h-[320px] min-w-full w-full flex-shrink-0 flex-col overflow-visible rounded-xl md:h-auto md:min-h-0 md:max-h-none md:flex-none">
              <BodyMap value={bodyParts} onChange={setBodyParts} singleView={isMobile} touchFriendly={isMobile} defaultZoom={isMobile ? 1.2 : undefined} />
            </div>
          </div>
        </div>
        {submitError && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">
            {submitError}
          </div>
        )}
        {!canSubmit && !loading && (bedTime.trim() === "" || wakeTime.trim() === "") && (
          <p className="text-sm text-amber-500/90">Please select Bed time and Wake time.</p>
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
