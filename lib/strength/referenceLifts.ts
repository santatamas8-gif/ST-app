import type { ReferenceLiftKey, StrengthProfile } from "./types";

/** Map Excel related_to text to profile column key. */
export function mapRelatedTo(relatedTo: string | null | undefined): ReferenceLiftKey {
  const n = (relatedTo ?? "").trim().toLowerCase();
  if (!n || n === "none" || n === "n/a") return "none";
  if (n === "bw" || n === "bodyweight" || n.includes("bodyweight")) return "bodyweight";
  if (n.includes("squat")) return "squat";
  if (n.includes("bench") || n.includes("chest press") || n.includes("chest_press")) return "bench_press";
  if (n.includes("deadlift") || n === "dl") return "deadlift";
  if (n.includes("pull") || n.includes("chin")) return "pull_up";
  if (n.includes("military") || n.includes("overhead") || n.includes("ohp")) return "military_press";
  if (n.includes("snatch")) return "snatch";
  if (n.includes("clean")) return "clean";
  return "none";
}

export function getReferenceValue(
  profile: Pick<
    StrengthProfile,
    "bodyweight" | "squat" | "bench_press" | "deadlift" | "pull_up" | "military_press" | "clean" | "snatch"
  >,
  relatedTo: string | null | undefined
): { key: ReferenceLiftKey; value: number | null; label: string } {
  const key = mapRelatedTo(relatedTo);
  const label = (relatedTo ?? "").trim() || key;

  if (key === "bodyweight") {
    return { key, value: profile.bodyweight, label: label || "Bodyweight" };
  }
  if (key === "none") {
    return { key, value: null, label };
  }

  const value = profile[key] ?? null;
  return { key, value, label };
}

export const REFERENCE_LIFT_LABELS: Record<Exclude<ReferenceLiftKey, "none" | "bodyweight">, string> = {
  squat: "Squat",
  bench_press: "Bench Press",
  deadlift: "Deadlift",
  pull_up: "Pull Up",
  military_press: "Military Press",
  clean: "Clean",
  snatch: "Snatch",
};
