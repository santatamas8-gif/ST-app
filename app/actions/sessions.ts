"use server";

import { getAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { SessionFormInput } from "@/lib/types";
import {
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
} from "@/lib/kioskRpe/constants";
import { isValidIsoDateString } from "@/lib/kioskRpe/submitValidation";
import { sessionLoad } from "@/utils/load";

export async function submitSession(form: SessionFormInput) {
  const appUser = await getAppUser();
  if (!appUser) return { error: "Not authenticated" };
  if (appUser.role !== "player") {
    return { error: "Only players can submit their own RPE." };
  }
  if (!isValidIsoDateString(form.date)) {
    return { error: "Date must be a valid calendar date." };
  }
  if (
    !Number.isInteger(form.duration) ||
    form.duration < MIN_DURATION_MINUTES ||
    form.duration > MAX_DURATION_MINUTES
  ) {
    return { error: `Duration must be between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES} minutes.` };
  }
  if (!Number.isInteger(form.rpe) || form.rpe < 1 || form.rpe > 10) {
    return { error: "RPE must be a whole number from 1 to 10." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", appUser.id)
    .eq("date", form.date)
    .limit(1);

  if (existing && existing.length > 0) {
    return { error: "You have already submitted RPE for this day." };
  }

  const load = sessionLoad(form.duration, form.rpe);

  const { error } = await supabase.from("sessions").insert({
    user_id: appUser.id,
    date: form.date,
    duration: form.duration,
    rpe: form.rpe,
    load,
  });

  if (error) return { error: error.message };
  revalidatePath("/rpe");
  revalidatePath("/dashboard");
  return { success: true };
}
