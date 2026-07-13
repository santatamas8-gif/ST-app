"use server";

import { getAppUser, isImmutableAdminEmail } from "@/lib/auth";
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
  if (!appUser) return { error: "Not authenticated." };
  if (newRole !== "admin" && newRole !== "staff" && newRole !== "player") {
    return { error: "Invalid role." };
  }

  const isPrimaryAdminPromotingSelf = userId === appUser.id && isImmutableAdminEmail(appUser.email) && newRole === "admin";
  if (!isPrimaryAdminPromotingSelf && appUser.role !== "admin") {
    return { error: "Only admin can change roles." };
  }

  if (newRole !== "admin") {
    if (userId === appUser.id && isImmutableAdminEmail(appUser.email)) {
      return { error: "The primary admin cannot be demoted." };
    }
    const supabase = await createClient();
    const { data: profile } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
    if (profile?.email && isImmutableAdminEmail(profile.email)) {
      return { error: "The primary admin cannot be demoted." };
    }
    try {
      const admin = createAdminClient();
      const { data: authData } = await admin.auth.admin.getUserById(userId);
      const targetEmail = authData?.user?.email ?? null;
      if (isImmutableAdminEmail(targetEmail)) {
        return { error: "The primary admin cannot be demoted." };
      }
    } catch {
      /* if admin client unavailable, profile check above already ran */
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);

  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  revalidatePath("/users");
  return { success: true };
}

export async function getReclaimAdminStatus(): Promise<{
  notLoggedIn?: boolean;
  alreadyAdmin?: boolean;
  canReclaim?: boolean;
}> {
  const appUser = await getAppUser();
  if (!appUser) return { notLoggedIn: true };
  if (appUser.role === "admin") return { alreadyAdmin: true };
  if (isImmutableAdminEmail(appUser.email)) return { canReclaim: true };
  return {};
}

export async function reclaimAdminRole(): Promise<{ error?: string }> {
  const appUser = await getAppUser();
  if (!appUser) return { error: "Not authenticated." };
  if (!isImmutableAdminEmail(appUser.email)) {
    return { error: "Only the primary admin can use this." };
  }
  if (appUser.role === "admin") {
    return {};
  }
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role: "admin" }).eq("id", appUser.id);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  revalidatePath("/users");
  revalidatePath("/reclaim-admin");
  return {};
}

export async function updateUserFullName(userId: string, fullName: string): Promise<{ error?: string }> {
  const appUser = await getAppUser();
  if (!appUser || appUser.role !== "admin") {
    return { error: "Only admin can change names." };
  }
  const trimmed = (fullName ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: trimmed || null }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  revalidatePath("/users");
  return {};
}
