"use client";

type BadgeType = "goodHigh" | "badHigh" | "badLow";

/** goodHigh: higher = better. Scale: 1–4 red, 5–7 yellow, 8+ green. badHigh/badLow use same bands. 0 = invalid (1–10 scale), treat as missing. */
function getColorClass(value: number | null | undefined, type: BadgeType): string {
  if (value == null || value === 0) return "bg-zinc-700/60 text-zinc-400";
  const v = value;
  switch (type) {
    case "goodHigh":
      // Keep the same hues but normalize "strength" across bands.
      if (v <= 4) return "bg-red-500/20 text-red-300";
      if (v <= 7) return "bg-yellow-500/30 text-yellow-300";
      return "bg-emerald-500/30 text-emerald-300";
    case "badHigh":
      if (v >= 8) return "bg-red-500/20 text-red-300";
      if (v >= 5) return "bg-yellow-500/30 text-yellow-300";
      return "bg-emerald-500/30 text-emerald-300";
    case "badLow":
      if (v <= 4) return "bg-red-500/20 text-red-300";
      if (v <= 7) return "bg-yellow-500/30 text-yellow-300";
      return "bg-emerald-500/30 text-emerald-300";
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
  const display = value != null && value !== 0 ? String(value) : "—";
  const colorClass = getColorClass(value, type);
  return (
    <span
      className={`inline-flex min-w-[3rem] justify-center rounded-md px-3 py-1 text-sm font-semibold tabular-nums ${colorClass} ${className}`}
    >
      {display}
    </span>
  );
}
