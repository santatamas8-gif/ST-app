"use server";

import { getAppUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

function isValidPassword(password: string): boolean {
  return password.length >= 6 && password.length <= 72;
}

export async function createPlayer(data: { email: string; password: string }) {
  const { email, password } = data;

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail) return { error: "Email is required." };
  if (!isValidEmail(trimmedEmail)) return { error: "Enter a valid email address." };
  if (!password) return { error: "Password is required." };
  if (!isValidPassword(password)) return { error: "Password must be at least 6 characters." };

  const appUser = await getAppUser();
  if (!appUser || appUser.role !== "admin") {
    return { error: "Only admin can add players." };
  }

  try {
    const admin = createAdminClient();
    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email: trimmedEmail,
        password,
        email_confirm: true,
      });

    if (authError) {
      if (authError.message.includes("already been registered"))
        return { error: "This email is already in use." };
      return { error: authError.message };
    }

    if (!authData.user?.id) return { error: "Failed to create user." };

    const supabase = await createClient();
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: authData.user.id,
        email: trimmedEmail,
        role: "player",
      },
      { onConflict: "id" }
    );

    if (profileError) {
      return { error: "Failed to save profile: " + profileError.message };
    }

    revalidatePath("/users");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error." };
  }
}
