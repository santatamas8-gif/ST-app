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

async function insertPlayerProfileIfMissing(
  userId: string,
  email: string
): Promise<AppUser["role"]> {
  const supabase = createClient();
  const { error } = await supabase.from(ROLES_TABLE).insert({
    id: userId,
    role: "player",
    email,
  });
  if (!error) return "player";
  const { data } = await supabase
    .from(ROLES_TABLE)
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (data?.role as AppUser["role"] | undefined) ?? "player";
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
  if (!authUser) return { error: "Sign-in failed." };

  let role: AppUser["role"] = "player";
  try {
    const { data: profile, error: profileError } = await supabase
      .from(ROLES_TABLE)
      .select("role")
      .eq("id", authUser.id)
      .maybeSingle();
    if (profile?.role) {
      role = profile.role as AppUser["role"];
    } else if (!profileError && !profile) {
      role = await insertPlayerProfileIfMissing(authUser.id, authUser.email ?? "");
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
    .maybeSingle();

  let role: AppUser["role"] = (profile?.role as AppUser["role"] | undefined) ?? "player";
  if (!profileError && !profile) {
    role = await insertPlayerProfileIfMissing(user.id, user.email ?? "");
  }

  return {
    id: user.id,
    email: user.email ?? "",
    role,
  };
}
