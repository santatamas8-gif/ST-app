"use server";

import { getAppUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { UserRole } from "@/lib/types";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

export async function createUser(data: {
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
}) {
  const { full_name, email, password, role } = data;

  const appUser = await getAppUser();
  if (!appUser || appUser.role !== "admin") {
    return { error: "Only admin can create users." };
  }

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = full_name.trim();

  if (!trimmedName) return { error: "Full name is required." };
  if (!trimmedEmail) return { error: "Email is required." };
  if (!isValidEmail(trimmedEmail)) return { error: "Enter a valid email address." };
  if (!password) return { error: "Password is required." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.` };
  }
  if (role !== "staff" && role !== "player" && role !== "admin") {
    return { error: "Role must be staff or player (or admin with confirmation)." };
  }

  try {
    const admin = createAdminClient();
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: trimmedEmail,
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes("already been registered") || authError.message.includes("already exists")) {
        return { error: "This email is already in use." };
      }
      return { error: authError.message };
    }

    if (!authData.user?.id) return { error: "Failed to create user." };

    const supabase = await createClient();
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: authData.user.id,
        email: trimmedEmail,
        full_name: trimmedName,
        role,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      return { error: "Failed to save profile: " + profileError.message };
    }

    revalidatePath("/admin/users");
    revalidatePath("/users");
    return { success: true, email: trimmedEmail, role };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error." };
  }
}

export async function updateUserRole(userId: string, newRole: UserRole) {
  const appUser = await getAppUser();
  if (!appUser || appUser.role !== "admin") {
    return { error: "Only admin can change roles." };
  }
  if (newRole !== "admin" && newRole !== "staff" && newRole !== "player") {
    return { error: "Invalid role." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);

  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  revalidatePath("/users");
  return { success: true };
}

export async function deactivateUser(userId: string) {
  const appUser = await getAppUser();
  if (!appUser || appUser.role !== "admin") {
    return { error: "Only admin can deactivate users." };
  }
  if (userId === appUser.id) {
    return { error: "You cannot deactivate your own account." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: false })
    .eq("id", userId);

  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  revalidatePath("/users");
  return { success: true };
}

export async function reactivateUser(userId: string) {
  const appUser = await getAppUser();
  if (!appUser || appUser.role !== "admin") {
    return { error: "Only admin can reactivate users." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: true })
    .eq("id", userId);

  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  revalidatePath("/users");
  return { success: true };
}

export async function deleteUserPermanently(userId: string) {
  const appUser = await getAppUser();
  if (!appUser || appUser.role !== "admin") {
    return { error: "Only admin can delete users permanently." };
  }
  if (userId === appUser.id) {
    return { error: "You cannot delete your own account." };
  }

  const admin = createAdminClient();

  const { error: wellnessErr } = await admin.from("wellness").delete().eq("user_id", userId);
  if (wellnessErr) return { error: "Failed to delete wellness data: " + wellnessErr.message };

  const { error: sessionsErr } = await admin.from("sessions").delete().eq("user_id", userId);
  if (sessionsErr) return { error: "Failed to delete sessions: " + sessionsErr.message };

  try {
    await admin.from("availability").delete().eq("user_id", userId);
  } catch {
    // availability table may not exist in all projects
  }

  const { error: profileErr } = await admin.from("profiles").delete().eq("id", userId);
  if (profileErr) return { error: "Failed to delete profile: " + profileErr.message };

  const { error: authErr } = await admin.auth.admin.deleteUser(userId);
  if (authErr) return { error: "Failed to remove auth user: " + authErr.message };

  revalidatePath("/admin/users");
  revalidatePath("/users");
  return { success: true };
}
