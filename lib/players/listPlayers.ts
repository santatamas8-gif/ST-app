import type { SupabaseClient } from "@supabase/supabase-js";

export type KioskPlayer = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
};

/** Display name: trimmed full_name → email → "Unknown player". */
export function playerDisplayName(
  fullName?: string | null,
  email?: string | null
): string {
  const name = (fullName ?? "").trim();
  if (name) return name;
  const mail = (email ?? "").trim();
  if (mail) return mail;
  return "Unknown player";
}

function normalizeAvatarUrl(url: string | null | undefined): string | null {
  const trimmed = (url ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Load all player profiles for Kiosk RPE (role = player).
 * Sorted alphabetically by display name (client-side).
 */
export async function listPlayersForKiosk(
  supabase: SupabaseClient
): Promise<{
  data: KioskPlayer[];
  error: { code?: string; message?: string } | null;
}> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, role")
    .eq("role", "player");

  if (error) {
    return { data: [], error };
  }

  const players = ((data ?? []) as ProfileRow[])
    .map((p) => ({
      id: p.id,
      name: playerDisplayName(p.full_name, p.email),
      avatarUrl: normalizeAvatarUrl(p.avatar_url),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  return { data: players, error: null };
}
