/**
 * Dashboard adatok: ma wellness / ma edzések (staff), vagy ma kitöltöttem-e (player).
 */

import { createClient } from "@/services/supabase/client";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getDashboardStats(): Promise<{
  hasTodayWellness?: boolean;
  todayWellnessCount?: number;
  todaySessionsCount?: number;
  error?: string;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const today = todayISO();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile as { role?: string } | null)?.role ?? "player";

  if (role === "player") {
    const { data } = await supabase
      .from("wellness")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", today)
      .limit(1);
    return { hasTodayWellness: (data?.length ?? 0) > 0 };
  }

  const { count: wellnessCount } = await supabase
    .from("wellness")
    .select("id", { count: "exact", head: true })
    .eq("date", today);

  const { count: sessionsCount } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("date", today);

  return {
    todayWellnessCount: wellnessCount ?? 0,
    todaySessionsCount: sessionsCount ?? 0,
  };
}
