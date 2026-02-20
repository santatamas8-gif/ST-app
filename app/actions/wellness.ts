"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { WellnessFormInput } from "@/lib/types";
import { sleepDurationHours } from "@/utils/sleep";

export async function submitWellness(form: WellnessFormInput) {
  const supabase = await createClient();
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
    bed_time: form.bed_time || null,
    wake_time: form.wake_time || null,
    sleep_duration: sleepDuration,
    sleep_quality: form.sleep_quality,
    soreness: form.soreness,
    fatigue: form.fatigue,
    stress: form.stress,
    mood: form.mood,
    bodyweight: form.bodyweight ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath("/wellness");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function submitDailyWellness(data: {
  sleep: number;
  fatigue: number;
  soreness: number;
  stress: number;
  mood: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("wellness")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  if (existing) {
    return { error: "You have already submitted for today." };
  }

  const { error } = await supabase.from("wellness").insert({
    user_id: user.id,
    date: today,
    bed_time: null,
    wake_time: null,
    sleep_duration: null,
    sleep_quality: data.sleep,
    soreness: data.soreness,
    fatigue: data.fatigue,
    stress: data.stress,
    mood: data.mood,
    bodyweight: null,
  });

  if (error) return { error: error.message };
  revalidatePath("/wellness");
  revalidatePath("/dashboard");
  return { success: true };
}
