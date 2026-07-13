/**
 * Admin: list profiles (RLS must allow admin read).
 */

import { createClient } from "@/services/supabase/client";

export interface ProfileRow {
  id: string;
  email: string | null;
  role: string | null;
  created_at: string | null;
  full_name: string | null;
}

export async function getProfiles(): Promise<{
  data: ProfileRow[] | null;
  error: string | null;
}> {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { data: null, error: "Not authenticated" };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, created_at, full_name")
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as ProfileRow[], error: null };
}
