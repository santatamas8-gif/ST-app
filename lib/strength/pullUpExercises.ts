/**
 * Fixed-% / reps-only exercises:
 * - Coach edits reps only
 * - The set % is fixed (scheme or 100%) and preserved on save
 * - Weight and % columns stay empty on the card
 */
export const DEFAULT_PULL_UP_SET_PERCENTAGE = 100;

/** Catalog rows for custom reps-only exercises (seeded if missing). */
export const REPS_ONLY_EXERCISE_SEED = [
  {
    name: "Inverted Row",
    category: "Pull",
    percent: 0,
    related_to: "None",
    percent_bw_used: 0,
    equipment_used: "Bodyweight",
    rounding: 1,
    note: "Reps only",
    video_url: null,
    image_url: null,
    active: true,
  },
  {
    name: "Band Pallof Press",
    category: "Core",
    percent: 0,
    related_to: "None",
    percent_bw_used: 0,
    equipment_used: "Band",
    rounding: 1,
    note: "Reps only",
    video_url: null,
    image_url: null,
    active: true,
  },
  {
    name: "Kettlebell Swing",
    category: "Kettlebell",
    percent: 0,
    related_to: "None",
    percent_bw_used: 0,
    equipment_used: "Kettlebell",
    rounding: 1,
    note: "Reps only",
    video_url: null,
    image_url: null,
    active: true,
  },
] as const;

const REPS_ONLY_CUSTOM_NAMES = new Set(
  REPS_ONLY_EXERCISE_SEED.map((e) => e.name.toLowerCase())
);

function isDipExercise(name: string): boolean {
  // Whole-word dip/dips (e.g. "Ring Dips", "Bar Dip", "Parallel Bar Dips").
  return /\bdips?\b/.test(name);
}

export function isRepsOnlyPullUpExercise(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase();
  if (!n || n.includes("pull down")) return false;

  if (REPS_ONLY_CUSTOM_NAMES.has(n)) return true;

  // Core kettlebell exercise (also reps-only, no % editing).
  // Handles minor naming variants: "around the world" vs "around the word".
  const isKbAroundWorldCore =
    n.includes("kb") &&
    n.includes("around") &&
    (n.includes("world") || n.includes("word"));

  return (
    n.includes("pull up") ||
    n.includes("pull-up") ||
    n.includes("pull-ups") ||
    n.includes("pullups") ||
    n.includes("chin up") ||
    n.includes("chin-up") ||
    isKbAroundWorldCore ||
    isDipExercise(n)
  );
}
