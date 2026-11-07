import "server-only";

import { normalizeAvatarUrl } from "@/lib/players/listPlayers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GPS player name → profile photo. Exact Power BI mapping wins over the profile name.
 * A missing photo is simply absent. Failure leaves the compare sheet without photos.
 */
export async function loadPlayerPhotoMap(): Promise<Record<string, string>> {
  try {
    const admin = createAdminClient();
    const [profilesResult, mappingsResult] = await Promise.all([
      admin.from("profiles").select("id, full_name, avatar_url").eq("role", "player"),
      admin.from("player_external_mappings").select("player_id, external_player_name").eq("provider", "powerbi"),
    ]);
    if (profilesResult.error) return {};

    const urlById = new Map<string, string>();
    const photos: Record<string, string> = {};
    for (const row of profilesResult.data ?? []) {
      const url = normalizeAvatarUrl(row.avatar_url);
      if (!url) continue;
      urlById.set(row.id, url);
      const name = (row.full_name ?? "").trim();
      if (name) photos[name] = url;
    }
    if (!mappingsResult.error) {
      for (const row of mappingsResult.data ?? []) {
        const name = (row.external_player_name ?? "").trim();
        const url = urlById.get(row.player_id);
        if (name && url) photos[name] = url;
      }
    }
    return photos;
  } catch {
    return {};
  }
}
