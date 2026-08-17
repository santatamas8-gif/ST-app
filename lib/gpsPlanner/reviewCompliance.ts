/**
 * Review UI plan-compliance colors only (display).
 * Does not change Planned / Actual / Diff calculations.
 * Colors = target compliance — not injury risk.
 */

export type ReviewComplianceTone = "green" | "orange" | "red";

export type ReviewComplianceMetric =
  | "td"
  | "hsr"
  | "sprint"
  | "acc"
  | "dec";

/**
 * Weekly green half-width in percentage points around that player's
 * saved Weekly Target % (player-specific — not hard-coded example targets).
 */
const WEEKLY_TOLERANCE_PP: Record<ReviewComplianceMetric, number> = {
  td: 20,
  hsr: 20,
  sprint: 10,
  acc: 20,
  dec: 20,
};

/**
 * Daily: Difference = Planned − Actual.
 * Red < 0; Green in [0, maxInclusive]; Orange > maxInclusive.
 */
const DAILY_GREEN_MAX: Record<ReviewComplianceMetric, number> = {
  td: 500,
  hsr: 100,
  sprint: 50,
  acc: 10,
  dec: 10,
};

/** Tailwind cell-box classes — soft tinted background, neutral digits. */
export function reviewComplianceToneClass(
  tone: ReviewComplianceTone | null
): string {
  switch (tone) {
    case "green":
      return "review-tone-green bg-emerald-100/70 text-zinc-700";
    case "orange":
      return "review-tone-orange bg-amber-100/70 text-zinc-700";
    case "red":
      return "review-tone-red bg-red-100/70 text-zinc-700";
    default:
      return "text-zinc-700";
  }
}

/**
 * Actual Weekly % = Weekly Actual absolute / frozen Match Best × 100.
 * Compare to that player's saved Weekly Target % ± metric tolerance.
 * Green inclusive of edges; orange below; red above.
 * Unsafe / incomplete Actual quality → neutral (null).
 */
export function weeklyComplianceTone(input: {
  metric: ReviewComplianceMetric;
  actual: number | null | undefined;
  matchBest: number | null | undefined;
  weeklyTargetPct: number | null | undefined;
  /** Only `complete` may receive compliance color. */
  actualCompleteness?:
    | "complete"
    | "partial_not_found"
    | "incomplete"
    | null;
}): ReviewComplianceTone | null {
  const { metric, actual, matchBest, weeklyTargetPct, actualCompleteness } =
    input;
  if (actualCompleteness != null && actualCompleteness !== "complete") {
    return null;
  }
  if (
    actual == null ||
    matchBest == null ||
    weeklyTargetPct == null ||
    !Number.isFinite(actual) ||
    !Number.isFinite(matchBest) ||
    !Number.isFinite(weeklyTargetPct) ||
    matchBest <= 0
  ) {
    return null;
  }
  const actualWeeklyPct = (actual / matchBest) * 100;
  if (!Number.isFinite(actualWeeklyPct)) return null;
  const tol = WEEKLY_TOLERANCE_PP[metric];
  const greenMin = weeklyTargetPct - tol;
  const greenMax = weeklyTargetPct + tol;
  if (actualWeeklyPct < greenMin) return "orange";
  if (actualWeeklyPct > greenMax) return "red";
  return "green";
}

/**
 * Daily Diff = Planned − Actual.
 * Red when Actual exceeded Planned (diff < 0).
 * Green when remaining is within tolerance.
 * Orange when still short beyond tolerance.
 */
export function dailyComplianceTone(input: {
  metric: ReviewComplianceMetric;
  difference: number | null | undefined;
}): ReviewComplianceTone | null {
  const { metric, difference } = input;
  if (difference == null || !Number.isFinite(difference)) return null;
  if (difference < 0) return "red";
  const max = DAILY_GREEN_MAX[metric];
  if (difference <= max) return "green";
  return "orange";
}

export const WEEKLY_COMPLIANCE_LEGEND = {
  title: "Weekly Target Compliance",
  items: [
    { tone: "green" as const, label: "Within target range" },
    { tone: "orange" as const, label: "Below target range" },
    { tone: "red" as const, label: "Above target range" },
  ],
  footnote:
    "Colors use each player's own Weekly Target % (TD/HSR/Acc/Dec ±20 pp, Sprint ±10 pp). Target compliance only, not injury risk.",
};

export const DAILY_COMPLIANCE_LEGEND = {
  title: "Daily Target Compliance",
  items: [
    { tone: "green" as const, label: "Within planned tolerance" },
    { tone: "orange" as const, label: "Below planned load" },
    { tone: "red" as const, label: "Planned load exceeded" },
  ],
  thresholds: [
    "TD: Green 0–500 | Orange >500 | Red <0",
    "HSR: Green 0–100 | Orange >100 | Red <0",
    "Sprint: Green 0–50 | Orange >50 | Red <0",
    "Acc: Green 0–10 | Orange >10 | Red <0",
    "Dec: Green 0–10 | Orange >10 | Red <0",
  ],
  footnote: "Colors indicate daily target compliance only, not injury risk.",
};
