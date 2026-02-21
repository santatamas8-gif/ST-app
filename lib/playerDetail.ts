import { createClient } from "@/lib/supabase/server";
import type { WellnessRow } from "@/lib/types";
import type { SessionRow } from "@/lib/types";

const DAYS = 14;

function getDateRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export async function getPlayerDetail(userId: string, viewerId: string, viewerRole: string) {
  const supabase = await createClient();
  if (viewerRole !== "admin" && viewerRole !== "staff" && viewerId !== userId) {
    return { error: "Forbidden", playerEmail: null, wellness: [], sessions: [] };
  }

  const { from, to } = getDateRange(DAYS);

  const [profileRes, wellnessRes, sessionsRes] = await Promise.all([
    supabase.from("profiles").select("email").eq("id", userId).maybeSingle(),
    supabase
      .from("wellness")
      .select("*")
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false }),
    supabase
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false }),
  ]);

  const playerEmail = (profileRes.data as { email?: string } | null)?.email ?? "—";
  const wellness = (wellnessRes.data ?? []) as WellnessRow[];
  const sessions = (sessionsRes.data ?? []) as SessionRow[];

  return { error: null, playerEmail, wellness, sessions, from, to };
}
