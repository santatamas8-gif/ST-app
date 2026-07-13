import { calculateSetWeight, formatDisplayWeight, inferLoadType } from "./calculation";
import { isExplosiveExercise } from "./explosiveExercises";
import { getReferenceValue } from "./referenceLifts";
import type { LoadType, StrengthExercise, StrengthProfile } from "./types";

export type CardSetInput = {
  set_number: number;
  reps: number;
  percentage: number;
};

export type ComputedCardItemFields = {
  exercise_id: string;
  exercise_name_snapshot: string;
  exercise_image_url_snapshot: string | null;
  set_number: number;
  reps: number;
  percentage: number;
  reference_lift: string;
  reference_value: number | null;
  exercise_percent: number;
  percent_bw_used: number;
  rounding: number;
  raw_weight: number | null;
  calculated_weight: number | null;
  coach_adjusted_weight: null;
  display_weight: string;
  load_type: LoadType;
  note_snapshot: string;
  exercise_order: number;
};

export function computeCardItemFields(
  exercise: StrengthExercise,
  profile: StrengthProfile,
  set: CardSetInput,
  exerciseOrder: number
): ComputedCardItemFields {
  const explosive = isExplosiveExercise(exercise.name);
  const ref = getReferenceValue(profile, exercise.related_to);
  const loadType = inferLoadType(exercise.note, exercise.equipment_used);
  const isBw = loadType === "bodyweight" && ref.value == null;

  let rawWeight: number | null = null;
  let roundedWeight: number | null = null;
  let displayWeight = "";

  if (!explosive) {
    const calculated = calculateSetWeight({
      referenceValue: ref.value,
      bodyweight: profile.bodyweight,
      exercisePercent: exercise.percent,
      setPercentage: set.percentage,
      percentBwUsed: exercise.percent_bw_used,
      rounding: exercise.rounding,
      isBodyweightExercise: isBw,
    });
    rawWeight = calculated.rawWeight;
    roundedWeight = calculated.roundedWeight;
    displayWeight = formatDisplayWeight(roundedWeight, loadType);
  }

  return {
    exercise_id: exercise.id,
    exercise_name_snapshot: exercise.name,
    exercise_image_url_snapshot: exercise.image_url,
    set_number: set.set_number,
    reps: set.reps,
    percentage: set.percentage,
    reference_lift: ref.label,
    reference_value: ref.value,
    exercise_percent: exercise.percent,
    percent_bw_used: exercise.percent_bw_used,
    rounding: exercise.rounding,
    raw_weight: rawWeight,
    calculated_weight: roundedWeight,
    coach_adjusted_weight: null,
    display_weight: displayWeight,
    load_type: loadType,
    note_snapshot: exercise.note,
    exercise_order: exerciseOrder,
  };
}
