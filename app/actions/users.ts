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
  if (!trimmedEmail) return { error: "Email megadása kötelező." };
  if (!isValidEmail(trimmedEmail)) return { error: "Érvényes email címet adj meg." };
  if (!password) return { error: "Jelszó megadása kötelező." };
  if (!isValidPassword(password)) return { error: "A jelszó legalább 6 karakter legyen." };

  const appUser = await getAppUser();
  if (!appUser || appUser.role !== "admin") {
    return { error: "Csak admin adhat hozzá játékost." };
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
        return { error: "Ez az email már használatban van." };
      return { error: authError.message };
    }

    if (!authData.user?.id) return { error: "Nem sikerült létrehozni a usert." };

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
      return { error: "Profil mentése sikertelen: " + profileError.message };
    }

    revalidatePath("/users");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Ismeretlen hiba." };
  }
}
