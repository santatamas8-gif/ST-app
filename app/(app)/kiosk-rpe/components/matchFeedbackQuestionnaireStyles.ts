/**
 * Match Feedback questionnaire UI-only styles (light theme + scale color progression).
 * Does not change stored values or validation.
 */

/** Neutral chip (Q1 / Q4) — unselected. */
export const MF_OPTION_NEUTRAL =
  "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400";

/** Neutral chip selected — app accent only (no semantic green/red/yellow). */
export const MF_OPTION_ACCENT_SELECTED =
  "border-emerald-600 bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";

export function neutralOptionClass(selected: boolean): string {
  return selected ? MF_OPTION_ACCENT_SELECTED : MF_OPTION_NEUTRAL;
}

/**
 * Demand scale (Q2 / Q5): GREEN → YELLOW → ORANGE → RED
 * Idle = pastel tint always visible; selected = stronger tint + ring.
 */
export const DEMAND_IDLE: Record<number, string> = {
  1: "border-emerald-300 bg-emerald-50/90 text-emerald-950 hover:border-emerald-400",
  2: "border-emerald-300 bg-emerald-50/80 text-emerald-950 hover:border-emerald-400",
  3: "border-lime-300 bg-lime-50/90 text-lime-950 hover:border-lime-400",
  4: "border-lime-300/90 bg-lime-50/70 text-lime-950 hover:border-lime-400",
  5: "border-yellow-300 bg-yellow-50/90 text-yellow-950 hover:border-yellow-400",
  6: "border-amber-300 bg-amber-50/90 text-amber-950 hover:border-amber-400",
  7: "border-orange-300 bg-orange-50/90 text-orange-950 hover:border-orange-400",
  8: "border-orange-400/80 bg-orange-50 text-orange-950 hover:border-orange-500",
  9: "border-red-300 bg-red-50/90 text-red-950 hover:border-red-400",
  10: "border-red-400/80 bg-red-50 text-red-950 hover:border-red-500",
};

export const DEMAND_SELECTED: Record<number, string> = {
  1: "border-emerald-600 bg-emerald-100 text-emerald-950 ring-2 ring-emerald-500/40",
  2: "border-emerald-600 bg-emerald-100 text-emerald-950 ring-2 ring-emerald-500/40",
  3: "border-lime-600 bg-lime-100 text-lime-950 ring-2 ring-lime-500/40",
  4: "border-lime-500 bg-lime-100/90 text-lime-950 ring-2 ring-lime-400/40",
  5: "border-yellow-500 bg-yellow-100 text-yellow-950 ring-2 ring-yellow-400/50",
  6: "border-amber-500 bg-amber-100 text-amber-950 ring-2 ring-amber-400/45",
  7: "border-orange-500 bg-orange-100 text-orange-950 ring-2 ring-orange-400/45",
  8: "border-orange-600 bg-orange-100 text-orange-950 ring-2 ring-orange-500/40",
  9: "border-red-500 bg-red-100 text-red-950 ring-2 ring-red-400/45",
  10: "border-red-700 bg-red-100 text-red-950 ring-2 ring-red-500/50",
};

export const DEMAND_BADGE_IDLE: Record<number, string> = {
  1: "bg-emerald-200/80 text-emerald-900",
  2: "bg-emerald-200/70 text-emerald-900",
  3: "bg-lime-200/80 text-lime-900",
  4: "bg-lime-200/70 text-lime-900",
  5: "bg-yellow-200/80 text-yellow-900",
  6: "bg-amber-200/80 text-amber-900",
  7: "bg-orange-200/80 text-orange-900",
  8: "bg-orange-300/70 text-orange-950",
  9: "bg-red-200/80 text-red-900",
  10: "bg-red-300/70 text-red-950",
};

export const DEMAND_BADGE_SELECTED: Record<number, string> = {
  1: "bg-emerald-600 text-white",
  2: "bg-emerald-600 text-white",
  3: "bg-lime-600 text-white",
  4: "bg-lime-500 text-white",
  5: "bg-yellow-500 text-yellow-950",
  6: "bg-amber-500 text-white",
  7: "bg-orange-500 text-white",
  8: "bg-orange-600 text-white",
  9: "bg-red-600 text-white",
  10: "bg-red-700 text-white",
};

/**
 * Performance scale (Q3): RED → ORANGE → YELLOW → GREEN (reversed vs demand).
 */
export const PERFORMANCE_IDLE: Record<number, string> = {
  1: "border-red-400/80 bg-red-50 text-red-950 hover:border-red-500",
  2: "border-red-300 bg-red-50/90 text-red-950 hover:border-red-400",
  3: "border-orange-400/80 bg-orange-50 text-orange-950 hover:border-orange-500",
  4: "border-orange-300 bg-orange-50/90 text-orange-950 hover:border-orange-400",
  5: "border-yellow-300 bg-yellow-50/90 text-yellow-950 hover:border-yellow-400",
  6: "border-lime-300/90 bg-lime-50/70 text-lime-950 hover:border-lime-400",
  7: "border-lime-300 bg-lime-50/90 text-lime-950 hover:border-lime-400",
  8: "border-emerald-300 bg-emerald-50/80 text-emerald-950 hover:border-emerald-400",
  9: "border-emerald-300 bg-emerald-50/90 text-emerald-950 hover:border-emerald-400",
  10: "border-emerald-400/80 bg-emerald-50 text-emerald-950 hover:border-emerald-500",
};

export const PERFORMANCE_SELECTED: Record<number, string> = {
  1: "border-red-700 bg-red-100 text-red-950 ring-2 ring-red-500/50",
  2: "border-red-500 bg-red-100 text-red-950 ring-2 ring-red-400/45",
  3: "border-orange-600 bg-orange-100 text-orange-950 ring-2 ring-orange-500/40",
  4: "border-orange-500 bg-orange-100 text-orange-950 ring-2 ring-orange-400/45",
  5: "border-yellow-500 bg-yellow-100 text-yellow-950 ring-2 ring-yellow-400/50",
  6: "border-lime-500 bg-lime-100/90 text-lime-950 ring-2 ring-lime-400/40",
  7: "border-lime-600 bg-lime-100 text-lime-950 ring-2 ring-lime-500/40",
  8: "border-emerald-600 bg-emerald-100 text-emerald-950 ring-2 ring-emerald-500/40",
  9: "border-emerald-600 bg-emerald-100 text-emerald-950 ring-2 ring-emerald-500/40",
  10: "border-emerald-700 bg-emerald-100 text-emerald-950 ring-2 ring-emerald-600/45",
};

export const PERFORMANCE_BADGE_IDLE: Record<number, string> = {
  1: "bg-red-300/70 text-red-950",
  2: "bg-red-200/80 text-red-900",
  3: "bg-orange-300/70 text-orange-950",
  4: "bg-orange-200/80 text-orange-900",
  5: "bg-yellow-200/80 text-yellow-900",
  6: "bg-lime-200/70 text-lime-900",
  7: "bg-lime-200/80 text-lime-900",
  8: "bg-emerald-200/70 text-emerald-900",
  9: "bg-emerald-200/80 text-emerald-900",
  10: "bg-emerald-300/70 text-emerald-950",
};

export const PERFORMANCE_BADGE_SELECTED: Record<number, string> = {
  1: "bg-red-700 text-white",
  2: "bg-red-600 text-white",
  3: "bg-orange-600 text-white",
  4: "bg-orange-500 text-white",
  5: "bg-yellow-500 text-yellow-950",
  6: "bg-lime-500 text-white",
  7: "bg-lime-600 text-white",
  8: "bg-emerald-600 text-white",
  9: "bg-emerald-600 text-white",
  10: "bg-emerald-800 text-white",
};

export const MF_QUESTION_CARD =
  "space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5";

export const MF_QUESTION_TITLE = "text-sm font-semibold text-zinc-900";

export const MF_QUESTION_HINT = "ml-2 font-normal text-zinc-500";
