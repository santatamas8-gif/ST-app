import { playerDisplayName } from "@/lib/players/listPlayers";
import type { HiitBasis, HiitFormat, HiitPlayerSpeed } from "@/lib/hiit/calc";
import { emptyGroup, type HiitGroupDraft, type HiitSessionDraft } from "@/lib/hiit/session";
import { createClient } from "@/lib/supabase/server";

export type HiitSpeedRow = {
  playerId: string;
  name: string;
  masKmh: string;
  mssKmh: string;
};

export type HiitSessionListItem = {
  id: string;
  title: string;
  sessionDate: string;
};

export async function loadHiitSpeedRows(): Promise<HiitSpeedRow[]> {
  const supabase = await createClient();
  const { data: players } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "player");
  const { data: speeds } = await supabase
    .from("hiit_player_speeds")
    .select("player_id, mas_kmh, mss_kmh");
  const byId = new Map((speeds ?? []).map((row) => [row.player_id as string, row]));
  return (players ?? [])
    .map((player) => {
      const speed = byId.get(player.id as string);
      return {
        playerId: player.id as string,
        name: playerDisplayName(player.full_name as string | null, player.email as string | null),
        masKmh: speed ? String(speed.mas_kmh) : "",
        mssKmh: speed ? String(speed.mss_kmh) : "",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export async function loadHiitPlayersWithSpeed(): Promise<HiitPlayerSpeed[]> {
  const rows = await loadHiitSpeedRows();
  return rows.flatMap((row) => {
    const mas = Number(row.masKmh);
    const mss = Number(row.mssKmh);
    if (!(mas > 0) || !(mss > mas)) return [];
    return [{ playerId: row.playerId, name: row.name, masKmh: mas, mssKmh: mss }];
  });
}

export async function loadHiitSessionList(): Promise<HiitSessionListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hiit_sessions")
    .select("id, title, session_date")
    .order("session_date", { ascending: false })
    .order("updated_at", { ascending: false });
  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    sessionDate: row.session_date as string,
  }));
}

export async function loadHiitSession(sessionId: string): Promise<HiitSessionDraft | null> {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("hiit_sessions")
    .select("id, title, session_date")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return null;
  const { data: groups } = await supabase
    .from("hiit_groups")
    .select("id, group_index, intensity_basis, percent, format, work_sec, rest_sec, reps, sets, shuttle_count, start_loss_sec, cod_loss_sec")
    .eq("session_id", sessionId)
    .order("group_index");
  const groupIds = (groups ?? []).map((group) => group.id as string);
  const { data: members } = groupIds.length
    ? await supabase.from("hiit_group_players").select("group_id, player_id").in("group_id", groupIds)
    : { data: [] };
  const playersByGroup = new Map<string, string[]>();
  for (const member of members ?? []) {
    const list = playersByGroup.get(member.group_id as string) ?? [];
    list.push(member.player_id as string);
    playersByGroup.set(member.group_id as string, list);
  }
  const drafts: HiitGroupDraft[] = [emptyGroup(), emptyGroup(), emptyGroup()];
  for (const group of groups ?? []) {
    const index = (group.group_index as number) - 1;
    if (index < 0 || index > 2) continue;
    drafts[index] = {
      intensityBasis: group.intensity_basis as HiitBasis,
      percent: Number(group.percent),
      format: group.format as HiitFormat,
      workSec: group.work_sec as number,
      restSec: group.rest_sec as number,
      reps: group.reps as number,
      sets: group.sets as number,
      shuttleCount: group.shuttle_count as number,
      startLossSec: Number(group.start_loss_sec),
      codLossSec: Number(group.cod_loss_sec),
      playerIds: playersByGroup.get(group.id as string) ?? [],
    };
  }
  return {
    id: session.id as string,
    title: session.title as string,
    sessionDate: session.session_date as string,
    groups: drafts as HiitSessionDraft["groups"],
  };
}
