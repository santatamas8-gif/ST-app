import type { PlayerCardItem } from "./types";
import { resolveExerciseImageUrl, type ExerciseImageMap } from "./exerciseImages";

export type ExerciseGroup = {
  key: string;
  name: string;
  imageUrl: string | null;
  sets: {
    id?: string;
    set_number: number;
    percentage: number;
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
        name: item.exercise_name_snapshot,
        imageUrl: resolveExerciseImageUrl(item, exerciseImages),
        sets: [],
      });
      order.push(key);
    }
    map.get(key)!.sets.push({
      id: item.id,
      set_number: item.set_number,
      percentage: item.percentage,
      reps: item.reps,
      display_weight: item.display_weight,
    });
  }

  return order.map((k) => map.get(k)!).slice(0, max);
}
