/**
 * Fixed-% / reps-only exercises:
 * - Coach edits reps only
 * - The set % is fixed (scheme or 100%) and preserved on save
 * - Weight and % columns stay empty on the card
 */
export const DEFAULT_PULL_UP_SET_PERCENTAGE = 100;

function isDipExercise(name: string): boolean {
  // Whole-word dip/dips (e.g. "Ring Dips", "Bar Dip", "Parallel Bar Dips").
  return /\bdips?\b/.test(name);
}

export function isRepsOnlyPullUpExercise(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase();
  if (!n || n.includes("pull down")) return false;

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
