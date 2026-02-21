"use server";

import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ScheduleActivityType } from "@/lib/types";

export async function getScheduleForMonth(
  from: string,
  to: string
): Promise<{ data: { id: string; date: string; activity_type: string; sort_order?: number }[]; error?: string }> {
  const user = await getAppUser();
  if (!user) return { data: [], error: "Not authenticated" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule")
    .select("id, date, activity_type, sort_order")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as { id: string; date: string; activity_type: string; sort_order?: number }[] };
}

export async function addScheduleItem(
  date: string,
  activity_type: ScheduleActivityType
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

  const { error } = await supabase.from("schedule").insert({
    date,
    activity_type,
    sort_order: nextOrder,
  });

  if (error) return { error: error.message };
  revalidatePath("/schedule");
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
  return {};
}
