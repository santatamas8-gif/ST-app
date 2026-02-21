/**
 * Wellness data layer. UI uses this only (no direct Supabase in UI).
 */

import { createClient } from "@/services/supabase/client";
import type { WellnessRow, WellnessFormInput } from "@/models/types";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function submitWellness(
  form: WellnessFormInput
): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const sleepDuration =
    form.bed_time && form.wake_time
      ? sleepDurationHours(form.bed_time, form.wake_time)
      : null;

  const { error } = await supabase.from("wellness").insert({
    user_id: user.id,
    date: form.date,
    bed_time: form.bed_time ?? null,
    wake_time: form.wake_time ?? null,
    sleep_duration: sleepDuration,
    sleep_quality: form.sleep_quality,
    soreness: form.soreness,
    fatigue: form.fatigue,
    stress: form.stress,
    mood: form.mood,
    bodyweight: form.bodyweight ?? null,
  });

  if (error) return { error: error.message };
  return {};
}

export async function submitDailyWellness(data: {
  sleep_quality: number;
  fatigue: number;
  soreness: number;
  stress: number;
  mood: number;
  bed_time?: string;
  wake_time?: string;
}): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const today = todayISO();

  const { data: existing } = await supabase
    .from("wellness")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  if (existing) return { error: "You have already submitted for today." };

  const sleepDuration =
    data.bed_time && data.wake_time
      ? sleepDurationHours(data.bed_time, data.wake_time)
      : null;

  const { error } = await supabase.from("wellness").insert({
    user_id: user.id,
    date: today,
    bed_time: data.bed_time ?? null,
    wake_time: data.wake_time ?? null,
    sleep_duration: sleepDuration,
    sleep_quality: data.sleep_quality,
    soreness: data.soreness,
    fatigue: data.fatigue,
    stress: data.stress,
    mood: data.mood,
    bodyweight: null,
  });

  if (error) return { error: error.message };
  return {};
}

export async function getMyWellnessEntries(limit = 14): Promise<{
  data: WellnessRow[] | null;
  error?: string;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Not authenticated" };

  const { data, error } = await supabase
    .from("wellness")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(limit);

  if (error) return { data: null, error: error.message };
  return { data: data as WellnessRow[], error: undefined };
}

/** Admin/staff: all players’ wellness entries + emails (RLS allows for admin/staff). */
export async function getWellnessSummaryForStaff(limit = 100): Promise<{
  data: WellnessRow[] | null;
  emailByUserId: Record<string, string>;
  error?: string;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, emailByUserId: {}, error: "Not authenticated" };

  const { data: rows, error } = await supabase
    .from("wellness")
    .select("*")
    .order("date", { ascending: false })
    .limit(limit);

  if (error) return { data: null, emailByUserId: {}, error: error.message };
  const list = (rows ?? []) as WellnessRow[];

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

function sleepDurationHours(bed: string, wake: string): number | null {
  const b = new Date(`1970-01-01T${bed}`);
  let w = new Date(`1970-01-01T${wake}`);
  if (w <= b) w = new Date(w.getTime() + 24 * 60 * 60 * 1000);
  return (w.getTime() - b.getTime()) / (60 * 60 * 1000);
}
