/**
 * Sessions (RPE) data layer.
 */

import { createClient } from "@/services/supabase/client";
import type { SessionRow, SessionFormInput } from "@/models/types";

export async function submitSession(
  form: SessionFormInput
): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const load = form.duration * form.rpe;

  const { error } = await supabase.from("sessions").insert({
    user_id: user.id,
    date: form.date,
    duration: form.duration,
    rpe: form.rpe,
    load,
  });

  if (error) return { error: error.message };
  return {};
}

export async function getMySessions(limit = 14): Promise<{
  data: SessionRow[] | null;
  error?: string;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Not authenticated" };

  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(limit);

  if (error) return { data: null, error: error.message };
  return { data: data as SessionRow[], error: undefined };
}

/** Admin/staff: all players' session entries + emails (RLS allows). */
export async function getSessionsSummaryForStaff(limit = 100): Promise<{
  data: SessionRow[] | null;
  emailByUserId: Record<string, string>;
  error?: string;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, emailByUserId: {}, error: "Not authenticated" };

  const { data: rows, error } = await supabase
    .from("sessions")
    .select("*")
    .order("date", { ascending: false })
    .limit(limit);

  if (error) return { data: null, emailByUserId: {}, error: error.message };
  const list = (rows ?? []) as SessionRow[];

  let emailByUserId: Record<string, string> = {};
  if (list.length > 0) {
    const userIds = [...new Set(list.map((r) => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds);
    if (profiles) {
      for (const p of profiles) {
        emailByUserId[p.id] = p.email ?? "—";
      }
    }
  }

  return { data: list, emailByUserId, error: undefined };
}
