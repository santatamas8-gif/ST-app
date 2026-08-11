import type { SupabaseClient } from "@supabase/supabase-js";
import { playerDisplayName, normalizeAvatarUrl, type KioskPlayer } from "@/lib/players/listPlayers";
import type { MatchFeedbackMatch, MatchFeedbackResponse, MatchFeedbackListItem } from "./types";
import type { PhysicalDropoff, PreMatchFeeling } from "./constants";

export type { MatchFeedbackListItem };

export type MatchFeedbackDetail = {
  match: MatchFeedbackMatch;
  participants: KioskPlayer[];
  responsesByPlayerId: Record<string, MatchFeedbackResponse>;
};

function mapResponse(row: Record<string, unknown>): MatchFeedbackResponse {
  return {
    id: String(row.id),
    match_id: String(row.match_id),
    player_id: String(row.player_id),
    pre_match_feelings: (row.pre_match_feelings as PreMatchFeeling[]) ?? [],
    pre_match_other_text: (row.pre_match_other_text as string | null) ?? null,
    physical_demand: Number(row.physical_demand),
    performance_rating: Number(row.performance_rating),
    physical_dropoff: row.physical_dropoff as PhysicalDropoff,
    mental_demand: Number(row.mental_demand),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listMatchFeedbackMatches(
  supabase: SupabaseClient
): Promise<{ data: MatchFeedbackListItem[]; error: { message?: string } | null }> {
  const { data: matches, error } = await supabase
    .from("match_feedback_matches")
    .select("id, opponent, match_date, matchday, created_by, created_at")
    .order("match_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return { data: [], error };

  const rows = (matches ?? []) as MatchFeedbackMatch[];
  if (rows.length === 0) return { data: [], error: null };

  const ids = rows.map((m) => m.id);
  const [{ data: parts }, { data: responses }] = await Promise.all([
    supabase.from("match_feedback_participants").select("match_id").in("match_id", ids),
    supabase.from("match_feedback_responses").select("match_id").in("match_id", ids),
  ]);

  const partCounts = new Map<string, number>();
  for (const p of parts ?? []) {
    const mid = (p as { match_id: string }).match_id;
    partCounts.set(mid, (partCounts.get(mid) ?? 0) + 1);
  }
  const respCounts = new Map<string, number>();
  for (const r of responses ?? []) {
    const mid = (r as { match_id: string }).match_id;
    respCounts.set(mid, (respCounts.get(mid) ?? 0) + 1);
  }

  return {
    data: rows.map((m) => ({
      ...m,
      participant_count: partCounts.get(m.id) ?? 0,
      response_count: respCounts.get(m.id) ?? 0,
    })),
    error: null,
  };
}

export async function loadMatchFeedbackDetail(
  supabase: SupabaseClient,
  matchId: string
): Promise<{ data: MatchFeedbackDetail | null; error: { message?: string } | null }> {
  const { data: match, error: matchError } = await supabase
    .from("match_feedback_matches")
    .select("id, opponent, match_date, matchday, created_by, created_at")
    .eq("id", matchId)
    .maybeSingle();

  if (matchError) return { data: null, error: matchError };
  if (!match) return { data: null, error: null };

  const { data: partRows, error: partError } = await supabase
    .from("match_feedback_participants")
    .select("player_id")
    .eq("match_id", matchId);

  if (partError) return { data: null, error: partError };

  const playerIds = (partRows ?? []).map((p: { player_id: string }) => p.player_id);
  let participants: KioskPlayer[] = [];

  if (playerIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", playerIds);

    if (profileError) return { data: null, error: profileError };

    const byId = new Map(
      (profiles ?? []).map((p: { id: string; full_name: string | null; email: string | null; avatar_url: string | null }) => [
        p.id,
        {
          id: p.id,
          name: playerDisplayName(p.full_name, p.email),
          avatarUrl: normalizeAvatarUrl(p.avatar_url),
        } satisfies KioskPlayer,
      ])
    );

    participants = playerIds
      .map((id) => byId.get(id))
      .filter((p): p is KioskPlayer => Boolean(p))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }

  const { data: responseRows, error: responseError } = await supabase
    .from("match_feedback_responses")
    .select("*")
    .eq("match_id", matchId);

  if (responseError) return { data: null, error: responseError };

  const responsesByPlayerId: Record<string, MatchFeedbackResponse> = {};
  for (const row of responseRows ?? []) {
    const mapped = mapResponse(row as Record<string, unknown>);
    responsesByPlayerId[mapped.player_id] = mapped;
  }

  return {
    data: {
      match: match as MatchFeedbackMatch,
      participants,
      responsesByPlayerId,
    },
    error: null,
  };
}
