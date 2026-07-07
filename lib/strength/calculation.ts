import type { LoadType } from "./types";

/** Excel-style ROUND(value, 0) — half away from zero. */
export function excelRound(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  const scaled = value * factor;
  const rounded =
    scaled >= 0
      ? Math.floor(scaled + 0.5)
      : Math.ceil(scaled - 0.5);
  return rounded / factor;
}

/** ROUND(raw_weight / rounding, 0) * rounding */
export function roundToIncrement(rawWeight: number, rounding: number): number {
  const inc = rounding > 0 ? rounding : 1;
  const divided = rawWeight / inc;
  return excelRound(divided, 0) * inc;
}

export function normalizeSetPercentage(percentage: number): number {
  if (percentage > 1) return percentage / 100;
  return percentage;
}

export function inferLoadType(note: string, equipmentUsed: string): LoadType {
  const text = `${note} ${equipmentUsed}`.toLowerCase();
  if (
    text.includes("each dumbbell") ||
    text.includes("each dumbell") ||
    text.includes("each hand") ||
    text.includes("per hand") ||
    text.includes("kg/hand") ||
    (text.includes("dumbbell") && text.includes("each"))
  ) {
    return "dumbbell_each";
  }
  if (
    text.includes("bodyweight") ||
    text === "bw" ||
    text.includes(" no load") ||
    text.includes("bw only")
  ) {
    return "bodyweight";
  }
  return "barbell";
}

export function formatDisplayWeight(
  roundedWeight: number | null,
  loadType: LoadType
): string {
  if (loadType === "bodyweight" || roundedWeight == null) return "BW";
  const w = Number.isInteger(roundedWeight) ? String(roundedWeight) : String(roundedWeight);
  if (loadType === "dumbbell_each") return `${w} kg/hand`;
  return `${w} kg`;
}

export function getFinalDisplayWeight(
  calculatedWeight: number | null,
  coachAdjustedWeight: number | null,
  loadType: LoadType
): string {
  const weight = coachAdjustedWeight ?? calculatedWeight;
  return formatDisplayWeight(weight, loadType);
}

export interface CalculateSetWeightInput {
  referenceValue: number | null;
  bodyweight: number | null;
  exercisePercent: number;
  setPercentage: number;
  percentBwUsed: number;
  rounding: number;
  isBodyweightExercise?: boolean;
}

export interface CalculateSetWeightResult {
  rawWeight: number | null;
  roundedWeight: number | null;
}

/**
 * Excel formula:
 * raw = reference_max * exercise_percent * set_percentage
 * If percent_bw_used: raw -= bodyweight * percent_bw_used
 * rounded = ROUND(raw / rounding, 0) * rounding
 */
export function calculateSetWeight(input: CalculateSetWeightInput): CalculateSetWeightResult {
  const {
    referenceValue,
    bodyweight,
    exercisePercent,
    setPercentage,
    percentBwUsed,
    rounding,
    isBodyweightExercise,
  } = input;

  const pct = normalizeSetPercentage(setPercentage);

  if (isBodyweightExercise && (referenceValue == null || exercisePercent === 0)) {
    return { rawWeight: null, roundedWeight: null };
  }

  if (referenceValue == null) {
    return { rawWeight: null, roundedWeight: null };
  }

  let raw = referenceValue * exercisePercent * pct;

  if (percentBwUsed > 0 && bodyweight != null) {
    raw -= bodyweight * percentBwUsed;
  }

  if (raw < 0) raw = 0;

  const rounded = roundToIncrement(raw, rounding > 0 ? rounding : 1);
  return { rawWeight: raw, roundedWeight: rounded };
}
