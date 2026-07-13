import type { SessionRow } from "@/lib/types";

export const DEFAULT_RECENT_KIOSK_BATCH_LIMIT = 20;
export const RECENT_KIOSK_DISCOVERY_ROW_LIMIT = 1000;

export type RecentKioskPlayerProfile = {
  id: string;
  full_name?: string | null;
  email?: string | null;
};

export type RecentKioskSessionDetail = {
  sessionId: string;
  playerId: string;
  playerName: string;
  rpe: number | null;
  duration: number;
  load: number | null;
  sessionType: string | null;
  matchdayTag: string | null;
};

export type RecentKioskSessionSummary = {
  batchId: string;
  date: string;
  submittedAt: string | null;
  playerCount: number;
  averageRpe: number;
  totalLoad: number;
  sessionTypeLabel: string;
  matchdayTagLabel: string;
  details: RecentKioskSessionDetail[];
};

export type RecentKioskSessionRow = Pick<
  SessionRow,
  | "id"
  | "user_id"
  | "date"
  | "duration"
  | "rpe"
  | "load"
  | "created_at"
  | "session_type"
  | "matchday_tag"
  | "kiosk_batch_id"
>;

export function recentKioskPlayerDisplayName(
  profile: RecentKioskPlayerProfile | null | undefined
): string {
  const fullName = profile?.full_name?.trim();
  if (fullName) return fullName;
  const email = profile?.email?.trim();
  if (email) return email;
  return "Unknown player";
}

export function buildRecentKioskPlayerNameMap(
  profiles: RecentKioskPlayerProfile[]
): Record<string, string> {
  const names: Record<string, string> = {};
  for (const profile of profiles) {
    names[profile.id] = recentKioskPlayerDisplayName(profile);
  }
  return names;
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function formatStrictAggregatedLabel(
  values: Array<string | null | undefined>,
  emptyLabel: string
): string {
  const normalized = values.map(normalizeText);
  const hasNull = normalized.some((value) => value === null);
  const realValues = [...new Set(normalized.filter((value): value is string => value !== null))];

  if (realValues.length === 0) return emptyLabel;
  if (realValues.length === 1 && !hasNull) return realValues[0];
  return "Multiple";
}

export function formatRecentKioskSessionTypeLabel(rows: RecentKioskSessionRow[]): string {
  return formatStrictAggregatedLabel(
    rows.map((row) => row.session_type),
    "—"
  );
}

export function formatRecentKioskMatchdayTagLabel(rows: RecentKioskSessionRow[]): string {
  return formatStrictAggregatedLabel(
    rows.map((row) => row.matchday_tag),
    "No tag"
  );
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function getEarliestValidCreatedAt(rows: RecentKioskSessionRow[]): string | null {
  const timestamps = rows
    .map((row) => row.created_at ?? null)
    .filter((value): value is string => Boolean(value && !Number.isNaN(Date.parse(value))))
    .sort((a, b) => Date.parse(a) - Date.parse(b));

  return timestamps[0] ?? null;
}

function getBatchSortTime(summary: RecentKioskSessionSummary): number {
  if (summary.submittedAt) return Date.parse(summary.submittedAt);
  const dateTime = Date.parse(summary.date);
  return Number.isNaN(dateTime) ? 0 : dateTime;
}

export function countDistinctKioskBatchIds(rows: Pick<SessionRow, "kiosk_batch_id">[]): number {
  const batchIds = new Set<string>();
  for (const row of rows) {
    const batchId = normalizeText(row.kiosk_batch_id);
    if (batchId) batchIds.add(batchId);
  }
  return batchIds.size;
}

export function groupRecentKioskSessions(
  rows: RecentKioskSessionRow[],
  playerNameById: Record<string, string>
): RecentKioskSessionSummary[] {
  const batches = new Map<string, RecentKioskSessionRow[]>();

  for (const row of rows) {
    const batchId = normalizeText(row.kiosk_batch_id);
    if (!batchId) continue;
    const batchRows = batches.get(batchId) ?? [];
    batchRows.push(row);
    batches.set(batchId, batchRows);
  }

  const summaries: RecentKioskSessionSummary[] = [];

  for (const [batchId, batchRows] of batches) {
    const validRpes = batchRows
      .map((row) => row.rpe)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const averageRpe =
      validRpes.length > 0
        ? roundOneDecimal(validRpes.reduce((sum, value) => sum + value, 0) / validRpes.length)
        : 0;
    const totalLoad = batchRows.reduce((sum, row) => {
      return sum + (typeof row.load === "number" && Number.isFinite(row.load) ? row.load : 0);
    }, 0);

    const details = batchRows
      .map((row) => ({
        sessionId: row.id,
        playerId: row.user_id,
        playerName: playerNameById[row.user_id] ?? "Unknown player",
        rpe: row.rpe,
        duration: row.duration,
        load: row.load,
        sessionType: row.session_type ?? null,
        matchdayTag: row.matchday_tag ?? null,
      }))
      .sort((a, b) => a.playerName.localeCompare(b.playerName, undefined, { sensitivity: "base" }));

    summaries.push({
      batchId,
      date: batchRows[0]?.date ?? "",
      submittedAt: getEarliestValidCreatedAt(batchRows),
      playerCount: new Set(batchRows.map((row) => row.user_id)).size,
      averageRpe,
      totalLoad,
      sessionTypeLabel: formatRecentKioskSessionTypeLabel(batchRows),
      matchdayTagLabel: formatRecentKioskMatchdayTagLabel(batchRows),
      details,
    });
  }

  return summaries.sort((a, b) => {
    const bySubmittedAt = getBatchSortTime(b) - getBatchSortTime(a);
    if (bySubmittedAt !== 0) return bySubmittedAt;
    return b.batchId.localeCompare(a.batchId);
  });
}
