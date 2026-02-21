/**
 * Auth service: login, logout, session.
 * Uses Supabase auth; session stored in SecureStore via client.
 */

import { createClient } from "@/services/supabase/client";
import type { Session } from "@supabase/supabase-js";

export interface AppUser {
  id: string;
  email: string;
  role: "admin" | "staff" | "player";
}

const ROLES_TABLE = "profiles";

export async function getSession(): Promise<Session | null> {
  const supabase = createClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session) return null;
  return session;
}

export async function signIn(
  email: string,
  password: string
): Promise<{ error?: string; user?: AppUser }> {
  const supabase = createClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: error.message };
  const authUser = authData.user;
  if (!authUser) return { error: "Bejelentkezés sikertelen." };

  let role: AppUser["role"] = "player";
  try {
    const { data: profile, error: profileError } = await supabase
      .from(ROLES_TABLE)
      .select("role")
      .eq("id", authUser.id)
      .maybeSingle();
    if (!profileError && profile?.role) role = profile.role as AppUser["role"];
    if (profileError || !profile) {
      await supabase.from(ROLES_TABLE).upsert(
        { id: authUser.id, role: "player", email: authUser.email ?? "" },
        { onConflict: "id" }
      );
    }
  } catch {
    role = "player";
  }

  const user: AppUser = {
    id: authUser.id,
    email: authUser.email ?? "",
    role,
  };
  return { user };
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function getAppUser(): Promise<AppUser | null> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from(ROLES_TABLE)
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "player";
  if (profileError && !profile) {
    await supabase.from(ROLES_TABLE).upsert(
      { id: user.id, role: "player", email: user.email ?? "" },
      { onConflict: "id" }
    );
  }

  return {
    id: user.id,
    email: user.email ?? "",
    role: (role as AppUser["role"]) ?? "player",
  };
}
