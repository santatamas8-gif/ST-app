import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

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
    .single();
  if (error || !data) return null;
  return data.role as UserRole;
}

/** Returns { role, is_active }. is_active defaults to true if column missing. */
async function getProfileForAuth(userId: string): Promise<{ role: UserRole; is_active: boolean } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(ROLES_TABLE)
    .select("role, is_active")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  const isActive = data.is_active === undefined ? true : !!data.is_active;
  return { role: data.role as UserRole, is_active: isActive };
}

export async function getAppUser() {
  const user = await getAuthUser();
  if (!user) return null;
  let profile = await getProfileForAuth(user.id);
  if (profile === null) {
    const supabase = await createClient();
    const { error } = await supabase
      .from(ROLES_TABLE)
      .upsert(
        { id: user.id, role: "player", email: user.email ?? "" },
        { onConflict: "id" }
      );
    if (!error) profile = { role: "player", is_active: true };
    if (profile === null) profile = { role: "player", is_active: true };
  }
  if (!profile.is_active) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    role: profile.role,
  };
}

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

export function canAccessUsers(role: UserRole): boolean {
  return role === "admin";
}
