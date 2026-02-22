"use server";

import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ScheduleActivityType } from "@/lib/types";

export type ScheduleItemRow = {
  id: string;
  date: string;
  activity_type: string;
  sort_order?: number;
  start_time: string | null;
  end_time: string | null;
};

export async function getScheduleForMonth(
  from: string,
  to: string
): Promise<{ data: ScheduleItemRow[]; error?: string }> {
  const user = await getAppUser();
  if (!user) return { data: [], error: "Not authenticated" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule")
    .select("id, date, activity_type, sort_order, start_time, end_time")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as ScheduleItemRow[] };
}

/** Parse and validate 24h HH:MM (00–23 hour, 00–59 minute). Returns "HH:MM" or null. */
function normalizeTime(s: string | null): string | null {
  if (s == null || s === "") return null;
  const match = String(s).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Validate 24h HH:MM; end must be after start if both present. */
function validateTimes(start: string | null, end: string | null): string | null {
  if (start == null || start === "") return "Start time is required.";
  const startNorm = normalizeTime(start);
  if (startNorm == null) return "Start time must be HH:MM (24h, 00:00–23:59).";
  if (end != null && end !== "") {
    const endNorm = normalizeTime(end);
    if (endNorm == null) return "End time must be HH:MM (24h, 00:00–23:59).";
    if (endNorm <= startNorm) return "End time must be after start time.";
  }
  return null;
}

export async function addScheduleItem(
  date: string,
  activity_type: ScheduleActivityType,
  startTime?: string | null,
  endTime?: string | null
): Promise<{ error?: string }> {
  const user = await getAppUser();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "admin" && user.role !== "staff") return { error: "Forbidden" };

  const supabase = await createClient();
  const { data: maxRow } = await supabase
    .from("schedule")
    .select("sort_order")
    .eq("date", date)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = ((maxRow as { sort_order?: number } | null)?.sort_order ?? 0) + 1;
  const start = normalizeTime(startTime ?? null);
  const end = normalizeTime(endTime ?? null);
  if (start != null || end != null) {
    const err = validateTimes(start, end);
    if (err) return { error: err };
  }

  const { error } = await supabase.from("schedule").insert({
    date,
    activity_type,
    sort_order: nextOrder,
    ...(start != null && { start_time: start }),
    ...(end != null && { end_time: end }),
  });

  if (error) return { error: error.message };
  revalidatePath("/schedule");
  revalidatePath("/dashboard");
  return {};
}

export async function updateScheduleItemTime(
  id: string,
  startTime: string | null,
  endTime: string | null
): Promise<{ error?: string }> {
  const user = await getAppUser();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "admin") return { error: "Only admin can set schedule times." };

  const start = normalizeTime(startTime);
  const end = normalizeTime(endTime);
  const err = validateTimes(start, end);
  if (err) return { error: err };

  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule")
    .update({
      start_time: start,
      end_time: end,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/schedule");
  revalidatePath("/dashboard");
  return {};
}

export async function removeScheduleItem(id: string): Promise<{ error?: string }> {
  const user = await getAppUser();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "admin" && user.role !== "staff") return { error: "Forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.from("schedule").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/schedule");
  revalidatePath("/dashboard");
  return {};
}
