"use client";

type BadgeType = "goodHigh" | "badHigh" | "badLow";

/** goodHigh: higher = better. Scale: 1–4 red, 5–7 yellow, 8+ green. badHigh/badLow use same bands. 0 = invalid (1–10 scale), treat as missing. */
export function getScoreTextClass(value: number | null | undefined, type: BadgeType): string {
  if (value == null || value === 0) return "text-zinc-400";
  const v = value;
  switch (type) {
    case "goodHigh":
      if (v <= 4) return "text-red-300";
      if (v <= 7) return "text-yellow-300";
      return "text-emerald-300";
    case "badHigh":
      if (v >= 8) return "text-red-300";
      if (v >= 5) return "text-yellow-300";
      return "text-emerald-300";
    case "badLow":
      if (v <= 4) return "text-red-300";
      if (v <= 7) return "text-yellow-300";
      return "text-emerald-300";
    default:
      return "text-zinc-400";
  }
}

function getBadgeColorClass(value: number | null | undefined, type: BadgeType): string {
  if (value == null || value === 0) return "bg-zinc-700/60 text-zinc-400";
  const v = value;
  switch (type) {
    case "goodHigh":
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
  plain?: boolean;
  className?: string;
}

export function BadgeScore({ value, type, plain = false, className = "" }: BadgeScoreProps) {
  const display = value != null && value !== 0 ? String(value) : "—";
  const colorClass = plain ? getScoreTextClass(value, type) : getBadgeColorClass(value, type);
  return (
    <span
      className={
        plain
          ? `inline-flex min-w-[1.5rem] justify-center tabular-nums text-sm font-semibold ${colorClass} ${className}`
          : `inline-flex min-w-[3rem] justify-center rounded-md px-3 py-1 text-sm font-semibold tabular-nums ${colorClass} ${className}`
      }
    >
      {display}
    </span>
  );
}
