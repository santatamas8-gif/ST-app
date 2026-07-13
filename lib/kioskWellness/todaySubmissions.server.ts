import type { SupabaseClient } from "@supabase/supabase-js";

export type WellnessSubmittedMap = Record<string, boolean>;

export async function getWellnessSubmittedForDate(
  supabase: SupabaseClient,
  playerIds: string[],
  date: string
): Promise<{ data: WellnessSubmittedMap; error: { message: string } | null }> {
  if (playerIds.length === 0) {
    return { data: {}, error: null };
  }

  const { data, error } = await supabase
    .from("wellness")
    .select("user_id")
    .eq("date", date)
    .in("user_id", playerIds);

  if (error) {
    return { data: {}, error: { message: error.message } };
  }

  const submitted: WellnessSubmittedMap = {};
  for (const row of data ?? []) {
    const userId = (row as { user_id: string }).user_id;
    submitted[userId] = true;
  }

  return { data: submitted, error: null };
}
