"use client";

type BadgeType = "goodHigh" | "badHigh" | "badLow";

/** goodHigh: higher = better (e.g. sleep quality, mood). badHigh: higher = worse (fatigue, soreness, stress). badLow: lower = worse (mood 1-3). */
function getColorClass(value: number | null | undefined, type: BadgeType): string {
  if (value == null) return "bg-zinc-700/60 text-zinc-400";
  const v = value;
  switch (type) {
    case "goodHigh":
      if (v <= 3) return "bg-red-600/25 text-red-300";
      if (v <= 6) return "bg-yellow-500/30 text-yellow-400";
      return "bg-emerald-500/20 text-emerald-400";
    case "badHigh":
      if (v >= 7) return "bg-red-600/25 text-red-300";
      if (v >= 4) return "bg-yellow-500/30 text-yellow-400";
      return "bg-emerald-500/20 text-emerald-400";
    case "badLow":
      if (v <= 3) return "bg-red-600/25 text-red-300";
      if (v <= 6) return "bg-yellow-500/30 text-yellow-400";
      return "bg-emerald-500/20 text-emerald-400";
    default:
      return "bg-zinc-700/60 text-zinc-400";
  }
}

interface BadgeScoreProps {
  value: number | null | undefined;
  type: BadgeType;
  className?: string;
}

export function BadgeScore({ value, type, className = "" }: BadgeScoreProps) {
  const display = value != null ? String(value) : "—";
  const colorClass = getColorClass(value, type);
  return (
    <span
      className={`inline-flex min-w-[3rem] justify-center rounded-md px-3 py-1 text-sm font-semibold tabular-nums ${colorClass} ${className}`}
    >
      {display}
    </span>
  );
}
