import "server-only";

/**
 * ADMIN-ONLY week-scoped Planner Groups + members (Phase A).
 * Selection helpers only — never touch targets/snapshots/Power BI.
 */

import { createClient } from "@/lib/supabase/server";
import { playerDisplayName } from "@/lib/players/listPlayers";
import {
  requirePlannerAdmin,
  requirePlannerAdminUser,
} from "@/lib/gpsPlanner/auth.server";
import {
  isPlannerUuid,
  mapPlannerDbError,
  normalizeGroupName,
  plannerErr,
  type PlannerResult,
} from "@/lib/gpsPlanner/common";

import type {
  PlannerGroupMemberRow,
  PlannerGroupRow,
} from "@/lib/gpsPlanner/types";

export type { PlannerGroupRow, PlannerGroupMemberRow };

type GroupDbRow = {
  id: string;
  week_id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type MemberDbRow = {
  group_id: string;
  player_id: string;
  added_at: string;
  added_by: string | null;
};

const GROUP_SELECT = "id, week_id, name, created_by, created_at, updated_at";
const MEMBER_SELECT = "group_id, player_id, added_at, added_by";

function mapGroup(row: GroupDbRow): PlannerGroupRow {
  return {
    id: row.id,
    weekId: row.week_id,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function assertWeekExists(
  weekId: string
): Promise<ReturnType<typeof plannerErr> | null> {
  if (!isPlannerUuid(weekId)) {
    return plannerErr("invalid_input", "weekId must be a valid UUID.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_weeks")
    .select("id")
    .eq("id", weekId)
    .maybeSingle();
  if (error) return mapPlannerDbError("assertWeekExists", error);
  if (!data) return plannerErr("week_not_found", "Planner week was not found.");
  return null;
}

async function loadGroup(
  groupId: string
): Promise<
  | { ok: true; group: GroupDbRow }
  | { ok: false; error: ReturnType<typeof plannerErr> }
> {
  if (!isPlannerUuid(groupId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "groupId must be a valid UUID."),
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_groups")
    .select(GROUP_SELECT)
    .eq("id", groupId)
    .maybeSingle();
  if (error) {
    return { ok: false, error: mapPlannerDbError("loadGroup", error) };
  }
  if (!data) {
    return {
      ok: false,
      error: plannerErr("group_not_found", "Planner group was not found."),
    };
  }
  return { ok: true, group: data as GroupDbRow };
}

async function requirePlayerProfile(
  playerId: string
): Promise<ReturnType<typeof plannerErr> | null> {
  if (!isPlannerUuid(playerId)) {
    return plannerErr("invalid_input", "playerId must be a valid UUID.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", playerId)
    .maybeSingle();
  if (error) return mapPlannerDbError("requirePlayerProfile", error);
  if (!data) {
    return plannerErr("player_not_found", "ST-AMS player profile was not found.");
  }
  if ((data as { role: string }).role !== "player") {
    return plannerErr(
      "not_a_player",
      "Only profiles with role 'player' may be group members."
    );
  }
  return null;
}

export async function listPlannerGroups(
  weekId: string
): Promise<PlannerResult<PlannerGroupRow[]>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  const weekError = await assertWeekExists(weekId);
  if (weekError) return { ok: false, error: weekError };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_groups")
    .select(GROUP_SELECT)
    .eq("week_id", weekId)
    .order("name", { ascending: true });

  if (error) {
    return { ok: false, error: mapPlannerDbError("listPlannerGroups", error) };
  }
  return { ok: true, data: ((data ?? []) as GroupDbRow[]).map(mapGroup) };
}

export async function getPlannerGroup(
  groupId: string
): Promise<PlannerResult<PlannerGroupRow | null>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (!isPlannerUuid(groupId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "groupId must be a valid UUID."),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_groups")
    .select(GROUP_SELECT)
    .eq("id", groupId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: mapPlannerDbError("getPlannerGroup", error) };
  }
  if (!data) return { ok: true, data: null };
  return { ok: true, data: mapGroup(data as GroupDbRow) };
}

export type CreatePlannerGroupInput = {
  weekId: string;
  name: string;
};

export async function createPlannerGroup(
  input: CreatePlannerGroupInput
): Promise<PlannerResult<PlannerGroupRow>> {
  const auth = await requirePlannerAdminUser();
  if (!auth.ok) return { ok: false, error: auth.error };

  const weekError = await assertWeekExists(input.weekId);
  if (weekError) return { ok: false, error: weekError };

  const name = normalizeGroupName(input.name ?? "");
  if (!name) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "Group name is required."),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_groups")
    .insert({
      week_id: input.weekId,
      name,
      created_by: auth.user.id,
    })
    .select(GROUP_SELECT)
    .single();

  if (error || !data) {
    return { ok: false, error: mapPlannerDbError("createPlannerGroup", error) };
  }
  return { ok: true, data: mapGroup(data as GroupDbRow) };
}

export type UpdatePlannerGroupInput = {
  groupId: string;
  name: string;
};

/** Rename only. week_id is immutable in Phase A. */
export async function updatePlannerGroup(
  input: UpdatePlannerGroupInput
): Promise<PlannerResult<PlannerGroupRow>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  const name = normalizeGroupName(input.name ?? "");
  if (!name) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "Group name is required."),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_groups")
    .update({ name })
    .eq("id", input.groupId)
    .select(GROUP_SELECT)
    .maybeSingle();

  if (error) {
    return { ok: false, error: mapPlannerDbError("updatePlannerGroup", error) };
  }
  if (!data) {
    return {
      ok: false,
      error: plannerErr("group_not_found", "Planner group was not found."),
    };
  }
  return { ok: true, data: mapGroup(data as GroupDbRow) };
}

/**
 * Delete group. Cascades group_members only.
 * Must never affect planner targets/snapshots.
 */
export async function deletePlannerGroup(
  groupId: string
): Promise<PlannerResult<{ groupId: string }>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (!isPlannerUuid(groupId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "groupId must be a valid UUID."),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_groups")
    .delete()
    .eq("id", groupId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: mapPlannerDbError("deletePlannerGroup", error) };
  }
  if (!data) {
    return {
      ok: false,
      error: plannerErr("group_not_found", "Planner group was not found."),
    };
  }
  return { ok: true, data: { groupId } };
}

export async function listPlannerGroupMembers(
  groupId: string
): Promise<PlannerResult<PlannerGroupMemberRow[]>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  const group = await loadGroup(groupId);
  if (!group.ok) return { ok: false, error: group.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_group_members")
    .select(MEMBER_SELECT)
    .eq("group_id", groupId)
    .order("added_at", { ascending: true });

  if (error) {
    return {
      ok: false,
      error: mapPlannerDbError("listPlannerGroupMembers", error),
    };
  }

  const rows = (data ?? []) as MemberDbRow[];
  const playerIds = rows.map((r) => r.player_id);
  const nameById = new Map<string, string>();
  if (playerIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", playerIds);
    if (profileError) {
      return {
        ok: false,
        error: mapPlannerDbError("listPlannerGroupMembers.profiles", profileError),
      };
    }
    for (const p of profiles ?? []) {
      const row = p as {
        id: string;
        full_name: string | null;
        email: string | null;
      };
      nameById.set(row.id, playerDisplayName(row.full_name, row.email));
    }
  }

  return {
    ok: true,
    data: rows.map((row) => ({
      groupId: row.group_id,
      playerId: row.player_id,
      addedAt: row.added_at,
      addedBy: row.added_by,
      playerDisplayName: nameById.get(row.player_id) ?? "Unknown player",
    })),
  };
}

export type AddPlannerGroupMemberInput = {
  groupId: string;
  playerId: string;
};

/**
 * Add a player to a week-scoped selection group.
 * Does not require Power BI mapping. Does not touch targets/snapshots.
 */
export async function addPlannerGroupMember(
  input: AddPlannerGroupMemberInput
): Promise<PlannerResult<PlannerGroupMemberRow>> {
  const auth = await requirePlannerAdminUser();
  if (!auth.ok) return { ok: false, error: auth.error };

  const group = await loadGroup(input.groupId);
  if (!group.ok) return { ok: false, error: group.error };

  const playerError = await requirePlayerProfile(input.playerId);
  if (playerError) return { ok: false, error: playerError };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_group_members")
    .insert({
      group_id: input.groupId,
      player_id: input.playerId,
      added_by: auth.user.id,
    })
    .select(MEMBER_SELECT)
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: mapPlannerDbError("addPlannerGroupMember", error),
    };
  }

  const row = data as MemberDbRow;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", row.player_id)
    .maybeSingle();
  const display = playerDisplayName(
    (profile as { full_name?: string | null } | null)?.full_name,
    (profile as { email?: string | null } | null)?.email
  );

  return {
    ok: true,
    data: {
      groupId: row.group_id,
      playerId: row.player_id,
      addedAt: row.added_at,
      addedBy: row.added_by,
      playerDisplayName: display,
    },
  };
}

export type RemovePlannerGroupMemberInput = {
  groupId: string;
  playerId: string;
};

export async function removePlannerGroupMember(
  input: RemovePlannerGroupMemberInput
): Promise<PlannerResult<{ groupId: string; playerId: string }>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (!isPlannerUuid(input.groupId) || !isPlannerUuid(input.playerId)) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_input",
        "groupId and playerId must be valid UUIDs."
      ),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_group_members")
    .delete()
    .eq("group_id", input.groupId)
    .eq("player_id", input.playerId)
    .select("group_id, player_id")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: mapPlannerDbError("removePlannerGroupMember", error),
    };
  }
  if (!data) {
    return {
      ok: false,
      error: plannerErr(
        "member_not_found",
        "Group membership was not found."
      ),
    };
  }
  return {
    ok: true,
    data: { groupId: input.groupId, playerId: input.playerId },
  };
}
