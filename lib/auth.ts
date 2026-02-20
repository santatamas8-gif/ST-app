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

export async function getAppUser() {
  const user = await getAuthUser();
  if (!user) return null;
  let role = await getUserRole(user.id);
  if (role === null) {
    const supabase = await createClient();
    const { error } = await supabase
      .from(ROLES_TABLE)
      .upsert(
        { id: user.id, role: "player", email: user.email ?? "" },
        { onConflict: "id" }
      );
    if (!error) role = "player";
    if (role === null) role = "player";
  }
  return {
    id: user.id,
    email: user.email ?? "",
    role,
  };
}

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

export function canAccessUsers(role: UserRole): boolean {
  return role === "admin";
}
