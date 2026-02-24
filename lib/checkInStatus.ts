import { createClient } from "@/lib/supabase/server";

/** For players only: whether today's wellness and RPE are submitted. */
export async function getPlayerCheckInStatus(userId: string): Promise<{
  wellnessDone: boolean;
  rpeDone: boolean;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createClient();

  const [wellnessRes, sessionsRes] = await Promise.all([
    supabase.from("wellness").select("id").eq("user_id", userId).eq("date", today).limit(1),
    supabase.from("sessions").select("id, load").eq("user_id", userId).eq("date", today).limit(10),
  ]);

  const wellnessDone = (wellnessRes.data ?? []).length > 0;
  const sessions = (sessionsRes.data ?? []) as { id: string; load: number | null }[];
  const rpeDone = sessions.some((s) => (s.load ?? 0) > 0);

  return { wellnessDone, rpeDone };
}
