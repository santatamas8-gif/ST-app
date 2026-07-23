import type { PlayerCardItem } from "./types";
import { resolveExerciseImageUrl, type ExerciseImageMap } from "./exerciseImages";
import { explosivePercentageLabel, isExplosiveExercise } from "./explosiveExercises";
import { isRepsOnlyPullUpExercise } from "./pullUpExercises";

export type ExerciseGroup = {
  key: string;
  exerciseId: string | null;
  exerciseOrder: number;
  name: string;
  imageUrl: string | null;
  repsOnlyPullUp: boolean;
  sets: {
    id?: string;
    set_number: number;
    percentage: number;
    display_percentage?: string;
    reps: number;
    display_weight: string;
  }[];
};

/** Display percentage as e.g. "72%". */
export function formatSetPercentage(percentage: number): string {
  const pct = percentage > 1 ? percentage : percentage * 100;
  const rounded = Math.round(pct * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

/** Group line items by exercise, ordered, capped at max (default 8). */
export function groupCardItemsByExercise(
  items: PlayerCardItem[],
  max = 8,
  exerciseImages?: ExerciseImageMap
): ExerciseGroup[] {
  const sorted = [...items].sort((a, b) => {
    const ao = a.exercise_order ?? 0;
    const bo = b.exercise_order ?? 0;
    if (ao !== bo) return ao - bo;
    return a.set_number - b.set_number;
  });

  const order: string[] = [];
  const map = new Map<string, ExerciseGroup>();

  for (const item of sorted) {
    const key = item.exercise_id ?? item.exercise_name_snapshot;
    if (!map.has(key)) {
      map.set(key, {
        key,
        exerciseId: item.exercise_id,
        exerciseOrder: item.exercise_order ?? 0,
        name: item.exercise_name_snapshot,
        imageUrl: resolveExerciseImageUrl(item, exerciseImages),
        repsOnlyPullUp: isRepsOnlyPullUpExercise(item.exercise_name_snapshot),
        sets: [],
      });
      order.push(key);
    }
    map.get(key)!.sets.push({
      id: item.id,
      set_number: item.set_number,
      percentage: item.percentage,
      display_percentage: explosivePercentageLabel(item.exercise_name_snapshot) ?? undefined,
      reps: item.reps,
      display_weight:
        isExplosiveExercise(item.exercise_name_snapshot) ||
        isRepsOnlyPullUpExercise(item.exercise_name_snapshot)
          ? ""
          : item.display_weight,
    });
  }

  return order.map((k) => map.get(k)!).slice(0, max);
}

/** Always return max slots (default 8). Missing exercise orders become empty placeholders. */
export type ExerciseSlot =
  | (ExerciseGroup & { empty?: false })
  | { empty: true; exerciseOrder: number };

export function padExerciseGroupsToSlots(
  groups: ExerciseGroup[],
  max = 8
): ExerciseSlot[] {
  const byOrder = new Map<number, ExerciseGroup>();
  for (const g of groups) {
    const order = g.exerciseOrder;
    if (order >= 1 && order <= max && !byOrder.has(order)) {
      byOrder.set(order, g);
    }
  }

  const slots: ExerciseSlot[] = [];
  for (let i = 1; i <= max; i++) {
    const existing = byOrder.get(i);
    slots.push(existing ?? { empty: true, exerciseOrder: i });
  }
  return slots;
}

export function isEmptyExerciseSlot(
  slot: ExerciseSlot
): slot is { empty: true; exerciseOrder: number } {
  return "empty" in slot && slot.empty === true;
}

