import { roundDurationToMinutes, roundPowerBi0 } from "@/lib/drillAnalysis/format";
import { buildOccurrenceKey, parseDrillStart } from "@/lib/drillAnalysis/keys";
import { parseGpsLogDurationToSeconds } from "@/lib/powerbi/queries/matchActualClassify";
import { parseIsoDateParts, pickRowValue, toNullableNumber } from "@/lib/powerbi/queries/rowUtils";
import {
  DRILL_METRICS,
  FULL_TRAINING_DRILL,
  type DrillMetricKey,
  type DrillMetrics,
  type DrillOccurrence,
  type ParsedDrillRow,
  type SessionRef,
} from "@/lib/drillAnalysis/types";

export function emptyMetrics(): DrillMetrics {
  return {
    totalDistance: null,
    tempoDistance: null,
    hsr: null,
    sprintDistance: null,
    distancePerMin: null,
    accelerations: null,
    decelerations: null,
  };
}

export function averageMetric(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

function metricsFromRow(row: Record<string, unknown>): DrillMetrics {
  return {
    totalDistance: toNullableNumber(pickRowValue(row, "TD")),
    tempoDistance: toNullableNumber(pickRowValue(row, "Z4")),
    hsr: toNullableNumber(pickRowValue(row, "Z5")),
    sprintDistance: toNullableNumber(pickRowValue(row, "Z6")),
    distancePerMin: toNullableNumber(pickRowValue(row, "DistancePerMin")),
    accelerations: toNullableNumber(pickRowValue(row, "Acc")),
    decelerations: toNullableNumber(pickRowValue(row, "Dec")),
  };
}

export function parseDrillSourceRow(row: Record<string, unknown>): ParsedDrillRow {
  const playerValue = pickRowValue(row, "Player");
  const drillValue = pickRowValue(row, "Drill");
  const player = typeof playerValue === "string" ? playerValue : playerValue == null ? "" : String(playerValue);
  const drill = typeof drillValue === "string" ? drillValue : drillValue == null ? "" : String(drillValue);
  const start = parseDrillStart(pickRowValue(row, "DrillStart"));
  return {
    player,
    drill,
    startToken: start.token,
    startLabel: start.label,
    startParsed: start.parsed,
    durationSeconds: parseGpsLogDurationToSeconds(pickRowValue(row, "Duration")),
    metrics: metricsFromRow(row),
    sourceRows: 1,
  };
}

export function parsePowerBiDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value !== "string") return null;
  const parsed = parseIsoDateParts(value);
  if (!parsed) return null;
  return `${String(parsed.year).padStart(4, "0")}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;
}

function metricSignature(metrics: DrillMetrics): string {
  return DRILL_METRICS.map((metric) => {
    const value = metrics[metric.key];
    return value === null ? "" : String(value);
  }).join("|");
}

function mergeMetricGroup(rows: ParsedDrillRow[]): {
  metrics: DrillMetrics;
  conflict: boolean;
  sourceRows: number;
} {
  const metrics = emptyMetrics();
  let conflict = false;
  for (const metric of DRILL_METRICS) {
    const values = rows.map((row) => row.metrics[metric.key]);
    const present = values.filter((value) => value !== null);
    const unique = new Set(present.map((value) => String(value)));
    const hasNull = values.some((value) => value === null);
    if (unique.size > 1 || (unique.size === 1 && hasNull)) {
      metrics[metric.key] = null;
      conflict = true;
    } else if (unique.size === 1) {
      metrics[metric.key] = present[0];
    } else {
      metrics[metric.key] = null;
    }
  }
  return {
    metrics,
    conflict,
    sourceRows: rows.reduce((sum, row) => sum + row.sourceRows, 0),
  };
}

type PlayerStart = {
  player: string;
  startToken: string;
  startLabel: string;
  startParsed: boolean;
  metrics: DrillMetrics;
  durationSeconds: number | null;
  conflict: boolean;
  sourceRows: number;
};

function durationForRows(rows: ParsedDrillRow[]): number | null {
  const minutes = rows.map((row) =>
    row.durationSeconds === null ? null : roundDurationToMinutes(row.durationSeconds)
  );
  if (minutes.some((value) => value === null) || !minutes.every((value) => value === minutes[0])) return null;
  return rows[0]?.durationSeconds ?? null;
}

function collapsePlayerStarts(rows: ParsedDrillRow[]): PlayerStart[] {
  const groups = new Map<string, ParsedDrillRow[]>();
  for (const row of rows) {
    const id = `${row.player}\u0000${row.startToken}`;
    const list = groups.get(id);
    if (list) list.push(row);
    else groups.set(id, [row]);
  }
  const collapsed: PlayerStart[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    const same = group.every((row) => metricSignature(row.metrics) === metricSignature(first.metrics));
    if (same) {
      collapsed.push({
        player: first.player,
        startToken: first.startToken,
        startLabel: first.startLabel,
        startParsed: first.startParsed,
        metrics: first.metrics,
        durationSeconds: durationForRows(group),
        conflict: false,
        sourceRows: group.reduce((sum, row) => sum + row.sourceRows, 0),
      });
    } else {
      const merged = mergeMetricGroup(group);
      collapsed.push({
        player: first.player,
        startToken: first.startToken,
        startLabel: first.startLabel,
        startParsed: first.startParsed,
        metrics: merged.metrics,
        durationSeconds: durationForRows(group),
        conflict: merged.conflict,
        sourceRows: merged.sourceRows,
      });
    }
  }
  return collapsed;
}

function earliestParsedClock(rows: PlayerStart[]): string | null {
  let earliest: string | null = null;
  for (const row of rows) {
    if (!row.startParsed || !/^\d{2}:\d{2}:\d{2}$/.test(row.startToken)) continue;
    if (earliest === null || row.startToken < earliest) earliest = row.startToken;
  }
  return earliest;
}

function modalStart(rows: PlayerStart[]): { token: string; label: string } {
  const counts = new Map<string, { count: number; label: string; parsed: boolean }>();
  for (const row of rows) {
    const current = counts.get(row.startToken);
    if (current) current.count += 1;
    else counts.set(row.startToken, { count: 1, label: row.startLabel, parsed: row.startParsed });
  }
  const ranked = [...counts.entries()].sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    if (a[1].parsed !== b[1].parsed) return a[1].parsed ? -1 : 1;
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });
  const winner = ranked[0];
  return { token: winner[0], label: winner[1].label };
}

function occurrenceFromPlayers(
  session: SessionRef,
  drill: string,
  identity: "cohort" | "start",
  startToken: string,
  players: PlayerStart[],
  timeLabel: string,
  timeUncertain: boolean
): DrillOccurrence {
  return {
    key: buildOccurrenceKey(session, drill, identity === "cohort" ? "cohort" : startToken),
    drill,
    identity,
    timeLabel,
    sortTime: earliestParsedClock(players),
    timeUncertain,
    playerCount: players.length,
    sourceRowCount: players.reduce((sum, player) => sum + player.sourceRows, 0),
    hasPlayerConflict: players.some((player) => player.conflict),
    players: players
      .map((player) => ({
        player: player.player,
        metrics: player.metrics,
        durationSeconds: player.durationSeconds,
      }))
      .sort((a, b) => (a.player < b.player ? -1 : a.player > b.player ? 1 : 0)),
  };
}

export function buildOccurrences(
  session: SessionRef,
  rows: ParsedDrillRow[]
): {
  occurrences: DrillOccurrence[];
  excludedBlankDrillRows: number;
  excludedBlankPlayerRows: number;
} {
  let excludedBlankDrillRows = 0;
  let excludedBlankPlayerRows = 0;
  const usable: ParsedDrillRow[] = [];
  for (const row of rows) {
    if (row.drill.trim() === "") {
      excludedBlankDrillRows += row.sourceRows;
      continue;
    }
    if (row.player.trim() === "") {
      excludedBlankPlayerRows += row.sourceRows;
      continue;
    }
    usable.push(row);
  }

  const byDrill = new Map<string, ParsedDrillRow[]>();
  for (const row of usable) {
    const list = byDrill.get(row.drill);
    if (list) list.push(row);
    else byDrill.set(row.drill, [row]);
  }

  const occurrences: DrillOccurrence[] = [];
  for (const [drill, drillRows] of byDrill) {
    const collapsed = collapsePlayerStarts(drillRows);
    const byPlayer = new Map<string, PlayerStart[]>();
    for (const row of collapsed) {
      const list = byPlayer.get(row.player);
      if (list) list.push(row);
      else byPlayer.set(row.player, [row]);
    }
    const repeated = [...byPlayer.values()].some((list) => list.length > 1);
    if (!repeated) {
      const tokens = new Set(collapsed.map((row) => row.startToken));
      const modal = modalStart(collapsed);
      const uncertain = tokens.size > 1 || collapsed.some((row) => !row.startParsed);
      const timeLabel = tokens.size > 1 ? `Start times differ (${modal.label})` : modal.label;
      occurrences.push(
        occurrenceFromPlayers(session, drill, "cohort", "cohort", collapsed, timeLabel, uncertain)
      );
      continue;
    }

    const byStart = new Map<string, PlayerStart[]>();
    for (const row of collapsed) {
      const list = byStart.get(row.startToken);
      if (list) list.push(row);
      else byStart.set(row.startToken, [row]);
    }
    for (const [startToken, players] of byStart) {
      const uncertain = players.some((player) => !player.startParsed);
      occurrences.push(
        occurrenceFromPlayers(
          session,
          drill,
          "start",
          startToken,
          players,
          players[0]?.startLabel ?? "No start time",
          uncertain
        )
      );
    }
  }

  occurrences.sort((a, b) => {
    if (a.sortTime === null && b.sortTime !== null) return 1;
    if (a.sortTime !== null && b.sortTime === null) return -1;
    if (a.sortTime !== null && b.sortTime !== null && a.sortTime !== b.sortTime) {
      return a.sortTime < b.sortTime ? -1 : 1;
    }
    if (a.drill !== b.drill) return a.drill < b.drill ? -1 : 1;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });

  return { occurrences, excludedBlankDrillRows, excludedBlankPlayerRows };
}

export function metricsForPlayer(
  occurrence: DrillOccurrence,
  player: string | null
): DrillMetrics {
  if (player === null) {
    const metrics = emptyMetrics();
    for (const metric of DRILL_METRICS) {
      metrics[metric.key] = averageMetric(occurrence.players.map((row) => row.metrics[metric.key]));
    }
    return metrics;
  }
  const match = occurrence.players.find((row) => row.player === player);
  if (!match) return emptyMetrics();
  return match.metrics;
}

export function roundedMetrics(metrics: DrillMetrics): DrillMetrics {
  const rounded = emptyMetrics();
  for (const metric of DRILL_METRICS) {
    const value = metrics[metric.key];
    rounded[metric.key] = value === null ? null : roundPowerBi0(value);
  }
  return rounded;
}

export function playerNames(occurrences: DrillOccurrence[]): string[] {
  const names = new Set<string>();
  for (const occurrence of occurrences) {
    for (const player of occurrence.players) names.add(player.player);
  }
  return [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function isFullTrainingDrill(drill: string): boolean {
  return drill === FULL_TRAINING_DRILL;
}

export function metricKeys(): DrillMetricKey[] {
  return DRILL_METRICS.map((metric) => metric.key);
}
