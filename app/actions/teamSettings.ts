"use server";

import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type TeamSettings = {
  team_name: string | null;
  team_logo_url: string | null;
};

export async function getTeamSettings(): Promise<TeamSettings> {
  const user = await getAppUser();
  if (!user) return { team_name: null, team_logo_url: null };

  const supabase = await createClient();
  const { data } = await supabase
    .from("team_settings")
    .select("team_name, team_logo_url")
    .limit(1)
    .maybeSingle();

  return {
    team_name: data?.team_name ?? null,
    team_logo_url: data?.team_logo_url ?? null,
  };
}

function truncate(str: string | null | undefined, max: number): string | null {
  if (str == null || typeof str !== "string") return null;
  const t = str.trim();
  return t === "" ? null : t.slice(0, max);
}

export async function updateTeamSettings(
  team_name: string | null,
  team_logo_url: string | null
): Promise<{ error?: string }> {
  const user = await getAppUser();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "admin") return { error: "Only admin can update team settings." };

  const supabase = await createClient();
  const nameVal = truncate(team_name, 200);
  const logoVal = truncate(team_logo_url, 500);

  const { data: row } = await supabase
    .from("team_settings")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!row?.id) return { error: "Team settings not found." };

  const { error } = await supabase
    .from("team_settings")
    .update({ team_name: nameVal, team_logo_url: logoVal, updated_at: new Date().toISOString() })
    .eq("id", row.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return {};
}
