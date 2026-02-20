"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { SessionFormInput } from "@/lib/types";
import { sessionLoad } from "@/utils/load";

export async function submitSession(form: SessionFormInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const load = sessionLoad(form.duration, form.rpe);

  const { error } = await supabase.from("sessions").insert({
    user_id: user.id,
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
