"use server";

import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { AvailabilityStatus } from "@/lib/types";

export async function getAvailability(
  userId: string,
  from: string,
  to: string
): Promise<{ data: { date: string; status: AvailabilityStatus }[]; error?: string }> {
  const user = await getAppUser();
  if (!user) return { data: [], error: "Not authenticated" };
  if (user.role !== "admin" && user.role !== "staff") {
    if (user.id !== userId) return { data: [], error: "Forbidden" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("availability")
    .select("date, status")
    .eq("user_id", userId)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as { date: string; status: AvailabilityStatus }[] };
}

export async function setAvailability(
  userId: string,
  date: string,
  status: AvailabilityStatus
): Promise<{ error?: string }> {
  const user = await getAppUser();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "admin" && user.role !== "staff") return { error: "Forbidden" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("availability")
    .upsert({ user_id: userId, date, status }, { onConflict: "user_id,date" });

  if (error) return { error: error.message };
  revalidatePath(`/players/${userId}`);
  revalidatePath("/dashboard");
  return {};
}

export async function clearAvailability(userId: string, date: string): Promise<{ error?: string }> {
  const user = await getAppUser();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "admin" && user.role !== "staff") return { error: "Forbidden" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("availability")
    .delete()
    .eq("user_id", userId)
    .eq("date", date);

  if (error) return { error: error.message };
  revalidatePath(`/players/${userId}`);
  revalidatePath("/dashboard");
  return {};
}
