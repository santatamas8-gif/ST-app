import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { PLANNER_HISTORY_SCHEMA_VERSION } from "@/lib/gpsPlanner/plannerHistoryAuth";

export type PlannerHistoryExportRow = {
  week_id: string;
  powerbi_week_id: string;
  start_date: string;
  end_date: string;
  player_id: string;
  powerbi_player_name: string;
  td_best: number;
  hsr_best: number;
  sprint_best: number;
  acc_best: number;
  dec_best: number;
};

export type PlannerHistoryExportPayload = {
  schema_version: number;
  generated_at: string;
  rows: PlannerHistoryExportRow[];
};

const SNAPSHOT_EXPORT_SELECT =
  "week_id, player_id, powerbi_player_name, td_best, hsr_best, sprint_best, acc_best, dec_best, planner_weeks!inner ( powerbi_week_id, start_date, end_date )";

type WeekEmbed = {
  powerbi_week_id?: unknown;
  start_date?: unknown;
  end_date?: unknown;
};

type SnapshotExportDbRow = {
  week_id?: unknown;
  player_id?: unknown;
  powerbi_player_name?: unknown;
  td_best?: unknown;
  hsr_best?: unknown;
  sprint_best?: unknown;
  acc_best?: unknown;
  dec_best?: unknown;
  planner_weeks?: WeekEmbed | WeekEmbed[] | null;
};

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function weekEmbed(value: SnapshotExportDbRow["planner_weeks"]): WeekEmbed | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function mapExportRow(row: SnapshotExportDbRow): PlannerHistoryExportRow | null {
  const week = weekEmbed(row.planner_weeks);
  const weekId = asNonEmptyString(row.week_id);
  const playerId = asNonEmptyString(row.player_id);
  const powerbiPlayerName = asNonEmptyString(row.powerbi_player_name);
  const powerbiWeekId = asNonEmptyString(week?.powerbi_week_id);
  const startDate = asNonEmptyString(week?.start_date);
  const endDate = asNonEmptyString(week?.end_date);
  const tdBest = asFiniteNumber(row.td_best);
  const hsrBest = asFiniteNumber(row.hsr_best);
  const sprintBest = asFiniteNumber(row.sprint_best);
  const accBest = asFiniteNumber(row.acc_best);
  const decBest = asFiniteNumber(row.dec_best);
  if (
    !weekId ||
    !playerId ||
    !powerbiPlayerName ||
    !powerbiWeekId ||
    !startDate ||
    !endDate ||
    tdBest === null ||
    hsrBest === null ||
    sprintBest === null ||
    accBest === null ||
    decBest === null
  ) {
    return null;
  }
  return {
    week_id: weekId,
    powerbi_week_id: powerbiWeekId,
    start_date: startDate,
    end_date: endDate,
    player_id: playerId,
    powerbi_player_name: powerbiPlayerName,
    td_best: tdBest,
    hsr_best: hsrBest,
    sprint_best: sprintBest,
    acc_best: accBest,
    dec_best: decBest,
  };
}

function compareExportRows(
  a: PlannerHistoryExportRow,
  b: PlannerHistoryExportRow
): number {
  if (a.start_date < b.start_date) return -1;
  if (a.start_date > b.start_date) return 1;
  if (a.powerbi_player_name < b.powerbi_player_name) return -1;
  if (a.powerbi_player_name > b.powerbi_player_name) return 1;
  return 0;
}

export async function loadPlannerHistoryExport(): Promise<
  | { ok: true; data: PlannerHistoryExportPayload }
  | { ok: false }
> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("planner_match_best_snapshots")
      .select(SNAPSHOT_EXPORT_SELECT);

    if (error) return { ok: false };

    const seen = new Set<string>();
    const rows: PlannerHistoryExportRow[] = [];
    for (const raw of (data ?? []) as SnapshotExportDbRow[]) {
      const mapped = mapExportRow(raw);
      if (!mapped) continue;
      const key = `${mapped.week_id}:${mapped.player_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(mapped);
    }
    rows.sort(compareExportRows);

    return {
      ok: true,
      data: {
        schema_version: PLANNER_HISTORY_SCHEMA_VERSION,
        generated_at: new Date().toISOString(),
        rows,
      },
    };
  } catch {
    return { ok: false };
  }
}
