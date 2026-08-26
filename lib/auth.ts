import { cache } from "react";
import { decideProfileRoleAction } from "@/lib/authRolePolicy";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

/**
 * Role-based access: admin (full), staff (read + schedule/players/wellness), player (own data only).
 * Layouts and pages use getAppUser().role and isAdmin/isStaff to guard routes and UI.
 */
const ROLES_TABLE = "profiles";

export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;
  return user;
}

export async function getUserRole(userId: string): Promise<UserRole | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(ROLES_TABLE)
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.role as UserRole;
}

async function insertProfileIfMissing(
  userId: string,
  email: string,
  role: UserRole
): Promise<UserRole> {
  const supabase = await createClient();
  const { error } = await supabase.from(ROLES_TABLE).insert({
    id: userId,
    role,
    email,
  });
  if (!error) return role;
  const { data } = await supabase
    .from(ROLES_TABLE)
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (data?.role as UserRole | undefined) ?? role;
}

async function restoreImmutableAdminRole(userId: string, email: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from(ROLES_TABLE)
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      await admin.from(ROLES_TABLE).update({ role: "admin" }).eq("id", userId);
      return;
    }
    await admin.from(ROLES_TABLE).insert({ id: userId, role: "admin", email });
  } catch {
    const supabase = await createClient();
    await supabase.from(ROLES_TABLE).update({ role: "admin" }).eq("id", userId);
    await supabase.from(ROLES_TABLE).insert({ id: userId, role: "admin", email });
  }
}

export const getAppUser = cache(async () => {
  try {
    const user = await getAuthUser();
    if (!user) return null;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from(ROLES_TABLE)
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const email = user.email ?? "";
    const decision = decideProfileRoleAction({
      role: (data?.role as UserRole | undefined) ?? null,
      profileExists: Boolean(data),
      readFailed: Boolean(error) && !data,
      isImmutableAdmin: isImmutableAdminEmail(email),
    });

    if (decision.action === "restore-admin") {
      await restoreImmutableAdminRole(user.id, email);
    } else if (decision.action === "insert-admin" || decision.action === "insert-player") {
      const written = await insertProfileIfMissing(user.id, email, decision.role);
      return {
        id: user.id,
        email,
        role: written,
      };
    }

    return {
      id: user.id,
      email,
      role: decision.role,
    };
  } catch {
    return null;
  }
});

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

export function isStaff(role: UserRole): boolean {
  return role === "admin" || role === "staff";
}

export function canAccessUsers(role: UserRole): boolean {
  return role === "admin";
}

/**
 * Primary admin email from env (IMMUTABLE_ADMIN_EMAIL). This user cannot be deleted or demoted by anyone.
 * Set in .env.local and on Vercel (e.g. IMMUTABLE_ADMIN_EMAIL=your@email.com). Server-side only.
 * Protection: updateUserRole (self + other admins), delete-user API, reclaimAdminRole (only this email can reclaim).
 * getAppUser also restores this email to admin if the stored role was overwritten.
 */
export function isImmutableAdminEmail(email: string | null | undefined): boolean {
  const immutable = process.env.IMMUTABLE_ADMIN_EMAIL?.trim().toLowerCase();
  if (!immutable) return false;
  return (email ?? "").trim().toLowerCase() === immutable;
}
