import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerCardItem } from "./types";
import { normalizeImageUrl } from "./imageUrl";

export type ExerciseImageMap = Record<string, string | null>;

export async function fetchExerciseImageMap(
  supabase: SupabaseClient,
  items: Pick<PlayerCardItem, "exercise_id">[]
): Promise<ExerciseImageMap> {
  const ids = [
    ...new Set(items.map((i) => i.exercise_id).filter((id): id is string => Boolean(id))),
  ];
  if (!ids.length) return {};

  const { data } = await supabase
    .from("strength_exercises")
    .select("id, image_url")
    .in("id", ids);

  const map: ExerciseImageMap = {};
  for (const row of data ?? []) {
    map[row.id] = normalizeImageUrl(row.image_url);
  }
  return map;
}

export function resolveExerciseImageUrl(
  item: Pick<PlayerCardItem, "exercise_id" | "exercise_image_url_snapshot">,
  exerciseImages?: ExerciseImageMap
): string | null {
  if (item.exercise_id && exerciseImages && item.exercise_id in exerciseImages) {
    return exerciseImages[item.exercise_id] ?? null;
  }
  return normalizeImageUrl(item.exercise_image_url_snapshot);
}

export async function syncCardItemImageSnapshots(
  supabase: SupabaseClient,
  exerciseId: string,
  imageUrl: string | null
): Promise<void> {
  await supabase
    .from("daily_strength_player_card_items")
    .update({ exercise_image_url_snapshot: imageUrl })
    .eq("exercise_id", exerciseId);
}
