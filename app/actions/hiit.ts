"use server";

import { revalidatePath } from "next/cache";
import { getAppUser } from "@/lib/auth";
import { asrKmh } from "@/lib/hiit/calc";
import type { HiitGroupDraft, HiitSessionDraft } from "@/lib/hiit/session";
import { createClient } from "@/lib/supabase/server";

async function requireCoach() {
  const user = await getAppUser();
  if (!user) return { user: null, error: "Not authenticated" };
  if (user.role !== "admin" && user.role !== "staff") return { user: null, error: "Forbidden" };
  return { user, error: null };
}

export async function saveHiitSpeeds(rows: { playerId: string; masKmh: number; mssKmh: number }[]) {
  const { user, error } = await requireCoach();
  if (!user) return { error: error ?? "Forbidden" };

  for (const row of rows) {
    if (asrKmh(row.masKmh, row.mssKmh) == null) {
      return { error: "MSS must be greater than MAS, both in km/h." };
    }
  }

  const supabase = await createClient();
  if (rows.length === 0) return { error: null };

  const { error: upsertError } = await supabase.from("hiit_player_speeds").upsert(
    rows.map((row) => ({
      player_id: row.playerId,
      mas_kmh: row.masKmh,
      mss_kmh: row.mssKmh,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })),
    { onConflict: "player_id" }
  );
  if (upsertError) return { error: upsertError.message };
  revalidatePath("/hiit");
  revalidatePath("/hiit/players");
  return { error: null };
}

function groupRow(sessionId: string, index: number, group: HiitGroupDraft) {
  return {
    session_id: sessionId,
    group_index: index,
    intensity_basis: group.intensityBasis,
    percent: group.percent,
    format: group.format,
    work_sec: group.workSec,
    rest_sec: group.restSec,
    reps: group.reps,
    sets: group.sets,
    shuttle_count: group.format === "shuttle" ? group.shuttleCount : 1,
    start_loss_sec: group.startLossSec,
    cod_loss_sec: group.codLossSec,
  };
}

export async function saveHiitSession(draft: HiitSessionDraft): Promise<{ id?: string; error: string | null }> {
  const { user, error } = await requireCoach();
  if (!user) return { error: error ?? "Forbidden" };

  const title = draft.title.trim();
  if (!title) return { error: "Add a session name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.sessionDate)) return { error: "Pick a date." };

  const seen = new Set<string>();
  for (const group of draft.groups) {
    if (!(group.workSec > 0) || group.restSec < 0 || !(group.reps > 0) || !(group.sets > 0)) {
      return { error: "Work, reps and sets must be greater than zero." };
    }
    if (group.intensityBasis === "mas" && !(group.percent > 0)) {
      return { error: "MAS percent must be greater than zero." };
    }
    if (group.intensityBasis === "asr" && group.percent < 0) {
      return { error: "ASR percent cannot be negative." };
    }
    if (group.format === "shuttle" && group.shuttleCount < 2) {
      return { error: "A shuttle needs at least 2 legs." };
    }
    for (const playerId of group.playerIds) {
      if (seen.has(playerId)) return { error: "A player can be in only one group." };
      seen.add(playerId);
    }
  }

  const supabase = await createClient();
  let sessionId = draft.id;

  if (sessionId) {
    const { error: updateError } = await supabase
      .from("hiit_sessions")
      .update({ title, session_date: draft.sessionDate, updated_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (updateError) return { error: updateError.message };
    const { error: deleteError } = await supabase.from("hiit_groups").delete().eq("session_id", sessionId);
    if (deleteError) return { error: deleteError.message };
  } else {
    const { data, error: insertError } = await supabase
      .from("hiit_sessions")
      .insert({ title, session_date: draft.sessionDate, created_by: user.id })
      .select("id")
      .single();
    if (insertError || !data) return { error: insertError?.message ?? "Could not save." };
    sessionId = data.id as string;
  }

  const { data: groups, error: groupError } = await supabase
    .from("hiit_groups")
    .insert(draft.groups.map((group, i) => groupRow(sessionId!, i + 1, group)))
    .select("id, group_index");
  if (groupError || !groups) return { error: groupError?.message ?? "Could not save groups." };

  const memberships = groups.flatMap((group) => {
    const draftGroup = draft.groups[(group.group_index as number) - 1];
    return (draftGroup?.playerIds ?? []).map((playerId) => ({
      group_id: group.id as string,
      player_id: playerId,
    }));
  });
  if (memberships.length > 0) {
    const { error: memberError } = await supabase.from("hiit_group_players").insert(memberships);
    if (memberError) return { error: memberError.message };
  }

  revalidatePath("/hiit");
  return { id: sessionId!, error: null };
}

export async function deleteHiitSession(sessionId: string) {
  const { user, error } = await requireCoach();
  if (!user) return { error: error ?? "Forbidden" };
  const supabase = await createClient();
  const { error: deleteError } = await supabase.from("hiit_sessions").delete().eq("id", sessionId);
  if (deleteError) return { error: deleteError.message };
  revalidatePath("/hiit");
  return { error: null };
}
