"use server";

/**
 * Thin ADMIN-ONLY GPS Planner server-action wrappers.
 * Domain logic lives in lib/gpsPlanner/*.server.ts — do not invent formulas here.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePlannerAdmin } from "@/lib/gpsPlanner/auth.server";
import {
  plannerErr,
  type PlannerResult,
} from "@/lib/gpsPlanner/common";
import {
  normalizeAvatarUrl,
  playerDisplayName,
} from "@/lib/players/listPlayers";

import {
  createPlannerWeek,
  deletePlannerWeek,
  listPlannerWeeks,
  updatePlannerWeek,
  type CreatePlannerWeekInput,
  type DeletePlannerWeekInput,
  type PlannerWeekRow,
  type UpdatePlannerWeekInput,
} from "@/lib/gpsPlanner/weeks.server";

import {
  createPlannerWeekDay,
  deletePlannerWeekDay,
  listPlannerWeekDays,
  updatePlannerWeekDay,
  type CreatePlannerWeekDayInput,
  type DeletePlannerWeekDayInput,
  type PlannerWeekDayRow,
  type UpdatePlannerWeekDayInput,
} from "@/lib/gpsPlanner/weekDays.server";

import {
  deletePlannerWeekOfficialMatch,
  getPlannerWeekOfficialMatch,
  getPlannerWeekOfficialMatches,
  setPlannerWeekOfficialMatch,
  type PlannerWeekOfficialMatch,
  type SetPlannerWeekOfficialMatchInput,
} from "@/lib/gpsPlanner/weekMatches.server";

import {
  addPlannerGroupMember,
  createPlannerGroup,
  deletePlannerGroup,
  listPlannerGroupMembers,
  listPlannerGroups,
  removePlannerGroupMember,
  updatePlannerGroup,
  type AddPlannerGroupMemberInput,
  type CreatePlannerGroupInput,
  type PlannerGroupMemberRow,
  type PlannerGroupRow,
  type RemovePlannerGroupMemberInput,
  type UpdatePlannerGroupInput,
} from "@/lib/gpsPlanner/groups.server";

import {
  createPlannerWeeklyTarget,
  deletePlannerWeeklyTarget,
  getPlannerMatchBestSnapshot,
  getPlannerWeeklyTarget,
  listPlannerWeeklyTargets,
  updatePlannerWeeklyTarget,
  type CreatePlannerWeeklyTargetInput,
  type CreatePlannerWeeklyTargetResult,
  type DeletePlannerWeeklyTargetInput,
  type PlannerMatchBestSnapshot,
  type PlannerWeeklyTargetView,
  type UpdatePlannerWeeklyTargetInput,
} from "@/lib/gpsPlanner/weeklyTargets.server";

import {
  createPlannerDailyTarget,
  deletePlannerDailyTarget,
  getPlannerDailyTarget,
  listPlannerDailyTargetsForDay,
  listPlannerDailyTargetsForPlayerWeek,
  updatePlannerDailyTarget,
  type CreatePlannerDailyTargetInput,
  type DeletePlannerDailyTargetInput,
  type PlannerDailyTargetView,
  type UpdatePlannerDailyTargetInput,
} from "@/lib/gpsPlanner/dailyTargets.server";

import {
  getPlannerDailyAnalysis,
  getPlannerDailyReviewAnalysis,
  getPlannerWeeklyProgress,
  getPlannerWeeklyReviewProgress,
  type PlannerDailyAnalysisResult,
  type PlannerWeeklyProgressResult,
} from "@/lib/gpsPlanner/progress.server";

import {
  getDailyPlanForPrint,
  type DailyPlanPrintResult,
} from "@/lib/gpsPlanner/dailyPlan.server";

import { getPlannerTotalLoad } from "@/lib/gpsPlanner/totalLoad.server";
import type { TotalLoadResult } from "@/lib/gpsPlanner/totalLoadAggregation";
import { listPlannerMatchCandidates } from "@/lib/gpsPlanner/matchCandidates.server";

import {
  createPlayerMapping,
  listPlayerMappings,
  listPowerBiPlayerCandidates,
  updatePlayerMapping,
  type CreatePlayerMappingInput,
  type UpdatePlayerMappingInput,
} from "@/lib/gpsPlanner/playerMappings.server";

import type {
  ApplyDailyTargetOutcome,
  ApplyWeeklyTargetOutcome,
  PlannerMatchCandidate,
  PlannerUiPlayer,
} from "@/lib/gpsPlanner/types";
import { plannerErrorMessage } from "@/lib/gpsPlanner/uiDisplay";

const PLANNER_PATH = "/admin/planner";

function revalidatePlanner(): void {
  revalidatePath(PLANNER_PATH);
}

// ── Weeks ───────────────────────────────────────────────────────────────────

export async function listPlannerWeeksAction(): Promise<
  PlannerResult<PlannerWeekRow[]>
> {
  return listPlannerWeeks();
}

export async function createPlannerWeekAction(
  input: CreatePlannerWeekInput
): Promise<PlannerResult<PlannerWeekRow>> {
  const result = await createPlannerWeek(input);
  if (result.ok) revalidatePlanner();
  return result;
}

export async function updatePlannerWeekAction(
  input: UpdatePlannerWeekInput
): Promise<PlannerResult<PlannerWeekRow>> {
  const result = await updatePlannerWeek(input);
  if (result.ok) revalidatePlanner();
  return result;
}

export async function deletePlannerWeekAction(
  input: DeletePlannerWeekInput
): Promise<PlannerResult<{ weekId: string }>> {
  const result = await deletePlannerWeek(input);
  if (result.ok) revalidatePlanner();
  return result;
}

// ── Week days ───────────────────────────────────────────────────────────────

export async function listPlannerWeekDaysAction(
  weekId: string
): Promise<PlannerResult<PlannerWeekDayRow[]>> {
  return listPlannerWeekDays(weekId);
}

export async function createPlannerWeekDayAction(
  input: CreatePlannerWeekDayInput
): Promise<PlannerResult<PlannerWeekDayRow>> {
  const result = await createPlannerWeekDay(input);
  if (result.ok) revalidatePlanner();
  return result;
}

export async function updatePlannerWeekDayAction(
  input: UpdatePlannerWeekDayInput
): Promise<PlannerResult<PlannerWeekDayRow>> {
  const result = await updatePlannerWeekDay(input);
  if (result.ok) revalidatePlanner();
  return result;
}

export async function deletePlannerWeekDayAction(
  input: DeletePlannerWeekDayInput
): Promise<PlannerResult<{ weekDayId: string }>> {
  const result = await deletePlannerWeekDay(input);
  if (result.ok) revalidatePlanner();
  return result;
}

// ── Official match (Total Load identity/display only) ────────────────────────

export async function getPlannerWeekOfficialMatchAction(
  weekId: string
): Promise<PlannerResult<PlannerWeekOfficialMatch | null>> {
  return getPlannerWeekOfficialMatch(weekId);
}

async function rejectPluralOfficialMatchMutation(
  weekId: string
): Promise<{ ok: false; error: ReturnType<typeof plannerErr> } | null> {
  const existing = await getPlannerWeekOfficialMatches(weekId);
  if (!existing.ok) return { ok: false, error: existing.error };
  if (existing.data.length > 1) {
    return {
      ok: false,
      error: plannerErr(
        "official_match_ambiguous",
        "This week has two official matches. The single-match selector cannot change them."
      ),
    };
  }
  return null;
}

export async function setPlannerWeekOfficialMatchAction(
  input: SetPlannerWeekOfficialMatchInput
): Promise<PlannerResult<PlannerWeekOfficialMatch>> {
  const blocked = await rejectPluralOfficialMatchMutation(input.weekId);
  if (blocked) return blocked;
  const result = await setPlannerWeekOfficialMatch(input);
  if (result.ok) revalidatePlanner();
  return result;
}

export async function deletePlannerWeekOfficialMatchAction(
  weekId: string
): Promise<PlannerResult<{ weekId: string }>> {
  const blocked = await rejectPluralOfficialMatchMutation(weekId);
  if (blocked) return blocked;
  const result = await deletePlannerWeekOfficialMatch(weekId);
  if (result.ok) revalidatePlanner();
  return result;
}

export async function getPlannerTotalLoadAction(
  weekId: string
): Promise<PlannerResult<TotalLoadResult>> {
  return getPlannerTotalLoad(weekId);
}

export async function listPlannerMatchCandidatesAction(
  weekId: string
): Promise<PlannerResult<PlannerMatchCandidate[]>> {
  return listPlannerMatchCandidates(weekId);
}

// ── Groups + members ────────────────────────────────────────────────────────

export async function listPlannerGroupsAction(
  weekId: string
): Promise<PlannerResult<PlannerGroupRow[]>> {
  return listPlannerGroups(weekId);
}

export async function createPlannerGroupAction(
  input: CreatePlannerGroupInput
): Promise<PlannerResult<PlannerGroupRow>> {
  const result = await createPlannerGroup(input);
  if (result.ok) revalidatePlanner();
  return result;
}

export async function updatePlannerGroupAction(
  input: UpdatePlannerGroupInput
): Promise<PlannerResult<PlannerGroupRow>> {
  const result = await updatePlannerGroup(input);
  if (result.ok) revalidatePlanner();
  return result;
}

export async function deletePlannerGroupAction(
  groupId: string
): Promise<PlannerResult<{ groupId: string }>> {
  const result = await deletePlannerGroup(groupId);
  if (result.ok) revalidatePlanner();
  return result;
}

export async function listPlannerGroupMembersAction(
  groupId: string
): Promise<PlannerResult<PlannerGroupMemberRow[]>> {
  return listPlannerGroupMembers(groupId);
}

export async function addPlannerGroupMemberAction(
  input: AddPlannerGroupMemberInput
): Promise<PlannerResult<PlannerGroupMemberRow>> {
  const result = await addPlannerGroupMember(input);
  if (result.ok) revalidatePlanner();
  return result;
}

export async function removePlannerGroupMemberAction(
  input: RemovePlannerGroupMemberInput
): Promise<PlannerResult<{ groupId: string; playerId: string }>> {
  const result = await removePlannerGroupMember(input);
  if (result.ok) revalidatePlanner();
  return result;
}

// ── Weekly targets + Match Best ─────────────────────────────────────────────

export async function getPlannerWeeklyTargetAction(
  weekId: string,
  playerId: string
): Promise<PlannerResult<PlannerWeeklyTargetView | null>> {
  return getPlannerWeeklyTarget(weekId, playerId);
}

export async function listPlannerWeeklyTargetsAction(
  weekId: string
): Promise<PlannerResult<PlannerWeeklyTargetView[]>> {
  return listPlannerWeeklyTargets(weekId);
}

export async function createPlannerWeeklyTargetAction(
  input: CreatePlannerWeeklyTargetInput
): Promise<PlannerResult<CreatePlannerWeeklyTargetResult>> {
  const result = await createPlannerWeeklyTarget(input);
  if (result.ok) revalidatePlanner();
  return result;
}

export async function updatePlannerWeeklyTargetAction(
  input: UpdatePlannerWeeklyTargetInput
): Promise<PlannerResult<PlannerWeeklyTargetView>> {
  const result = await updatePlannerWeeklyTarget(input);
  if (result.ok) revalidatePlanner();
  return result;
}

export async function deletePlannerWeeklyTargetAction(
  input: DeletePlannerWeeklyTargetInput
): Promise<PlannerResult<{ weekId: string; playerId: string }>> {
  const result = await deletePlannerWeeklyTarget(input);
  if (result.ok) revalidatePlanner();
  return result;
}

export async function getPlannerMatchBestSnapshotAction(
  weekId: string,
  playerId: string
): Promise<PlannerResult<PlannerMatchBestSnapshot | null>> {
  return getPlannerMatchBestSnapshot(weekId, playerId);
}

// ── Daily targets ───────────────────────────────────────────────────────────

export async function getPlannerDailyTargetAction(
  weekDayId: string,
  playerId: string
): Promise<PlannerResult<PlannerDailyTargetView | null>> {
  return getPlannerDailyTarget(weekDayId, playerId);
}

export async function listPlannerDailyTargetsForDayAction(
  weekDayId: string
): Promise<PlannerResult<PlannerDailyTargetView[]>> {
  return listPlannerDailyTargetsForDay(weekDayId);
}

export async function listPlannerDailyTargetsForPlayerWeekAction(
  weekId: string,
  playerId: string
): Promise<PlannerResult<PlannerDailyTargetView[]>> {
  return listPlannerDailyTargetsForPlayerWeek(weekId, playerId);
}

export async function createPlannerDailyTargetAction(
  input: CreatePlannerDailyTargetInput
): Promise<PlannerResult<PlannerDailyTargetView>> {
  const result = await createPlannerDailyTarget(input);
  if (result.ok) revalidatePlanner();
  return result;
}

export async function updatePlannerDailyTargetAction(
  input: UpdatePlannerDailyTargetInput
): Promise<PlannerResult<PlannerDailyTargetView>> {
  const result = await updatePlannerDailyTarget(input);
  if (result.ok) revalidatePlanner();
  return result;
}

export async function deletePlannerDailyTargetAction(
  input: DeletePlannerDailyTargetInput
): Promise<PlannerResult<{ weekDayId: string; playerId: string }>> {
  const result = await deletePlannerDailyTarget(input);
  if (result.ok) revalidatePlanner();
  return result;
}

// ── Progress / analysis ─────────────────────────────────────────────────────

export async function getPlannerWeeklyProgressAction(input: {
  weekId: string;
  playerId: string;
  throughDate: string;
}): Promise<PlannerResult<PlannerWeeklyProgressResult>> {
  return getPlannerWeeklyProgress(input);
}

/** Weekly Review — day-batched Power BI Actual for all Weekly Target players. */
export async function getPlannerWeeklyReviewProgressAction(input: {
  weekId: string;
  throughDate: string;
}): Promise<PlannerResult<PlannerWeeklyProgressResult[]>> {
  return getPlannerWeeklyReviewProgress(input);
}

export async function getPlannerDailyAnalysisAction(input: {
  weekDayId: string;
  playerId: string;
}): Promise<PlannerResult<PlannerDailyAnalysisResult>> {
  return getPlannerDailyAnalysis(input);
}

/** Daily Review — one Power BI day-batch for all Weekly Target players. */
export async function getPlannerDailyReviewAnalysisAction(input: {
  weekDayId: string;
}): Promise<PlannerResult<PlannerDailyAnalysisResult[]>> {
  return getPlannerDailyReviewAnalysis(input);
}

// ── Daily Plan print ────────────────────────────────────────────────────────

export async function getDailyPlanForPrintAction(input: {
  weekDayId: string;
  playerIds: string[];
}): Promise<PlannerResult<DailyPlanPrintResult>> {
  return getDailyPlanForPrint(input);
}

// ── UI players + bulk apply ─────────────────────────────────────────────────

export async function listPlannerUiPlayers(): Promise<
  PlannerResult<PlannerUiPlayer[]>
> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, role")
    .eq("role", "player");

  if (error) {
    return {
      ok: false,
      error: plannerErr("database_error", "Could not load players."),
    };
  }

  const players = (data ?? [])
    .map((p) => {
      const row = p as {
        id: string;
        full_name: string | null;
        email: string | null;
        avatar_url: string | null;
      };
      return {
        id: row.id,
        name: playerDisplayName(row.full_name, row.email),
        avatarUrl: normalizeAvatarUrl(row.avatar_url),
      };
    })
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );

  return { ok: true, data: players };
}

export type ApplyWeeklyTargetsInput = {
  weekId: string;
  playerIds: string[];
  tdPct: number;
  hsrPct: number;
  sprintPct: number;
  accPct: number;
  decPct: number;
};

/**
 * Per-player create-or-update Weekly Targets. No formula invention.
 * Uses existing get/create/update domain functions only.
 */
export async function applyWeeklyTargetsToPlayers(
  input: ApplyWeeklyTargetsInput
): Promise<PlannerResult<ApplyWeeklyTargetOutcome[]>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  const outcomes: ApplyWeeklyTargetOutcome[] = [];
  let anySuccess = false;

  for (const playerId of input.playerIds) {
    const existing = await getPlannerWeeklyTarget(input.weekId, playerId);
    if (!existing.ok) {
      outcomes.push({
        playerId,
        status: "failed",
        message: plannerErrorMessage(
          existing.error.code,
          existing.error.message
        ),
      });
      continue;
    }

    if (existing.data) {
      const updated = await updatePlannerWeeklyTarget({
        weekId: input.weekId,
        playerId,
        tdPct: input.tdPct,
        hsrPct: input.hsrPct,
        sprintPct: input.sprintPct,
        accPct: input.accPct,
        decPct: input.decPct,
      });
      if (updated.ok) {
        anySuccess = true;
        outcomes.push({ playerId, status: "updated" });
      } else {
        outcomes.push({
          playerId,
          status: "failed",
          message: plannerErrorMessage(
            updated.error.code,
            updated.error.message
          ),
        });
      }
    } else {
      const created = await createPlannerWeeklyTarget({
        weekId: input.weekId,
        playerId,
        tdPct: input.tdPct,
        hsrPct: input.hsrPct,
        sprintPct: input.sprintPct,
        accPct: input.accPct,
        decPct: input.decPct,
      });
      if (created.ok) {
        anySuccess = true;
        outcomes.push({ playerId, status: "created" });
      } else {
        outcomes.push({
          playerId,
          status: "failed",
          message: plannerErrorMessage(
            created.error.code,
            created.error.message
          ),
        });
      }
    }
  }

  if (anySuccess) revalidatePlanner();
  return { ok: true, data: outcomes };
}

export type ApplyDailyTargetToPlayersInput = {
  weekDayId: string;
  playerIds: string[];
  tdPct: number;
  hsrPct: number;
  sprintPct: number;
  accPct: number;
  decPct: number;
};

/**
 * Per-player create-or-update Daily Targets for one week day.
 * Same percentages for each selected player; absolutes stay player-specific
 * via frozen Match Best inside existing domain create/update.
 * Does not call Power BI.
 */
export async function applyDailyTargetToPlayers(
  input: ApplyDailyTargetToPlayersInput
): Promise<PlannerResult<ApplyDailyTargetOutcome[]>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  const outcomes: ApplyDailyTargetOutcome[] = [];
  let anySuccess = false;
  const pct = {
    tdPct: input.tdPct,
    hsrPct: input.hsrPct,
    sprintPct: input.sprintPct,
    accPct: input.accPct,
    decPct: input.decPct,
  };

  for (const playerId of input.playerIds) {
    const existing = await getPlannerDailyTarget(input.weekDayId, playerId);
    if (!existing.ok) {
      outcomes.push({
        playerId,
        status: "failed",
        message: plannerErrorMessage(
          existing.error.code,
          existing.error.message
        ),
      });
      continue;
    }

    if (existing.data) {
      const updated = await updatePlannerDailyTarget({
        weekDayId: input.weekDayId,
        playerId,
        ...pct,
      });
      if (updated.ok) {
        anySuccess = true;
        outcomes.push({ playerId, status: "updated" });
      } else {
        outcomes.push({
          playerId,
          status: "failed",
          message: plannerErrorMessage(
            updated.error.code,
            updated.error.message
          ),
        });
      }
    } else {
      const created = await createPlannerDailyTarget({
        weekDayId: input.weekDayId,
        playerId,
        ...pct,
      });
      if (created.ok) {
        anySuccess = true;
        outcomes.push({ playerId, status: "created" });
      } else {
        outcomes.push({
          playerId,
          status: "failed",
          message: plannerErrorMessage(
            created.error.code,
            created.error.message
          ),
        });
      }
    }
  }

  if (anySuccess) revalidatePlanner();
  return { ok: true, data: outcomes };
}

// ── Player ↔ Power BI mappings ──────────────────────────────────────────────

export async function listPowerBiPlayerCandidatesAction(): Promise<
  Awaited<ReturnType<typeof listPowerBiPlayerCandidates>>
> {
  return listPowerBiPlayerCandidates();
}

export async function listPlayerMappingsAction(): Promise<
  Awaited<ReturnType<typeof listPlayerMappings>>
> {
  return listPlayerMappings();
}

export async function createPlayerMappingAction(
  input: CreatePlayerMappingInput
): Promise<Awaited<ReturnType<typeof createPlayerMapping>>> {
  const result = await createPlayerMapping(input);
  if (result.ok) revalidatePlanner();
  return result;
}

export async function updatePlayerMappingAction(
  input: UpdatePlayerMappingInput
): Promise<Awaited<ReturnType<typeof updatePlayerMapping>>> {
  const result = await updatePlayerMapping(input);
  if (result.ok) revalidatePlanner();
  return result;
}
