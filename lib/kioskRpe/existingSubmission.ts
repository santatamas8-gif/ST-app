import { sessionLoad } from "@/utils/load";
import type { KioskRpeSubmitEntry } from "@/lib/kioskRpe/submitValidation";
import type { KioskPlayerState } from "@/lib/kioskRpe/types";
import type { SessionRow } from "@/lib/types";

export type ExistingKioskSubmissionRow = Pick<
  SessionRow,
  | "id"
  | "user_id"
  | "date"
  | "duration"
  | "rpe"
  | "load"
  | "session_type"
  | "matchday_tag"
  | "kiosk_batch_id"
  | "created_at"
>;

export type ExistingSubmissionClassification =
  | { status: "none" }
  | { status: "single"; row: ExistingKioskSubmissionRow }
  | { status: "multiple"; rows: ExistingKioskSubmissionRow[] };

export type ExistingSubmissionMap = Record<string, ExistingKioskSubmissionRow>;

export type KioskSessionUpdateRow = {
  id: string;
  user_id: string;
  date: string;
  duration: number;
  rpe: number;
  load: number;
  session_type: string;
  matchday_tag: string | null;
  kiosk_batch_id: string;
};

export type MixedKioskBatchRows = {
  updates: KioskSessionUpdateRow[];
  inserts: Array<{
    user_id: string;
    date: string;
    duration: number;
    rpe: number;
    load: number;
    session_type: string;
    matchday_tag: string | null;
    kiosk_batch_id: string;
  }>;
};

function emptyMetadata(value: string | null | undefined): boolean {
  return (value ?? "").trim() === "";
}

function validRpe(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10;
}

export function isEligibleSameDayPhoneSubmission(
  row: ExistingKioskSubmissionRow,
  options: { playerId: string; date: string }
): boolean {
  return (
    row.user_id === options.playerId &&
    row.date === options.date &&
    emptyMetadata(row.kiosk_batch_id) &&
    emptyMetadata(row.session_type) &&
    emptyMetadata(row.matchday_tag) &&
    validRpe(row.rpe)
  );
}

export function classifyEligibleSameDayPhoneSubmissions(
  rows: ExistingKioskSubmissionRow[],
  options: { playerId: string; date: string }
): ExistingSubmissionClassification {
  const eligible = rows.filter((row) => isEligibleSameDayPhoneSubmission(row, options));
  if (eligible.length === 0) return { status: "none" };
  if (eligible.length === 1) return { status: "single", row: eligible[0] };
  return { status: "multiple", rows: eligible };
}

export function buildExistingSubmissionMap(
  rows: ExistingKioskSubmissionRow[],
  players: { id: string }[],
  date: string
): {
  submissions: ExistingSubmissionMap;
  conflictPlayerIds: string[];
} {
  const submissions: ExistingSubmissionMap = {};
  const conflictPlayerIds: string[] = [];

  for (const player of players) {
    const classification = classifyEligibleSameDayPhoneSubmissions(rows, {
      playerId: player.id,
      date,
    });
    if (classification.status === "single") {
      submissions[player.id] = classification.row;
    } else if (classification.status === "multiple") {
      conflictPlayerIds.push(player.id);
    }
  }

  return { submissions, conflictPlayerIds };
}

export function createExistingSubmissionPlayerState(
  playerId: string,
  row: ExistingKioskSubmissionRow,
  defaults: Pick<KioskPlayerState, "sessionType" | "matchdayTag" | "duration">
): KioskPlayerState {
  return {
    playerId,
    sessionType: defaults.sessionType,
    matchdayTag: defaults.matchdayTag,
    duration: defaults.duration,
    rpe: validRpe(row.rpe) ? row.rpe : null,
    source: "existingSubmission",
    existingSessionId: row.id,
  };
}

export function isExistingSubmissionLocked(state: KioskPlayerState | undefined): boolean {
  return state?.source === "existingSubmission" && Boolean(state.existingSessionId);
}

export function buildMixedKioskBatchRows({
  date,
  entries,
  existingRowsByPlayerId,
  kioskBatchId,
}: {
  date: string;
  entries: KioskRpeSubmitEntry[];
  existingRowsByPlayerId: Record<string, ExistingKioskSubmissionRow | undefined>;
  kioskBatchId: string;
}): MixedKioskBatchRows {
  const updates: MixedKioskBatchRows["updates"] = [];
  const inserts: MixedKioskBatchRows["inserts"] = [];

  for (const entry of entries) {
    const existingRow = existingRowsByPlayerId[entry.playerId];
    if (existingRow) {
      const storedRpe = validRpe(existingRow.rpe) ? existingRow.rpe : entry.rpe;
      updates.push({
        id: existingRow.id,
        user_id: entry.playerId,
        date,
        duration: entry.durationMinutes,
        rpe: storedRpe,
        load: sessionLoad(entry.durationMinutes, storedRpe),
        session_type: entry.sessionType,
        matchday_tag: entry.matchdayTag,
        kiosk_batch_id: kioskBatchId,
      });
      continue;
    }

    inserts.push({
      user_id: entry.playerId,
      date,
      duration: entry.durationMinutes,
      rpe: entry.rpe,
      load: sessionLoad(entry.durationMinutes, entry.rpe),
      session_type: entry.sessionType,
      matchday_tag: entry.matchdayTag,
      kiosk_batch_id: kioskBatchId,
    });
  }

  return { updates, inserts };
}
