/** Pure Match Actual raw-row classification (safe for unit tests). */

import {
  pickRowValue,
  toNullableNumber,
} from "@/lib/powerbi/queries/rowUtils";

export const MATCH_ACTUAL_MD_TAG = "MD";
export const MATCH_ACTUAL_SESSION_TYPE = "Team";
export const MATCH_ACTUAL_FIRST_HALF = "1st Half";
export const MATCH_ACTUAL_SECOND_HALF = "2nd Half";

export type MatchHalfCardinality = "absent" | "valid" | "ambiguous";

export type MatchActualQuality =
  | "match_zero"
  | "match_ok"
  | "match_ambiguous"
  | "data_issue";

export type MatchActualMetrics = {
  totalDistance: number;
  hsr: number;
  sprint: number;
  accelerations: number;
  decelerations: number;
  durationSeconds: number;
};

export type MatchActualPlayerResult = {
  playerName: string;
  quality: MatchActualQuality;
  halves: {
    first: MatchHalfCardinality;
    second: MatchHalfCardinality;
  };
  /** Present only for match_ok and match_zero. */
  metrics: MatchActualMetrics | null;
};

export type MatchActualHalfMetrics = {
  totalDistance: number;
  hsr: number;
  sprint: number;
  accelerations: number;
  decelerations: number;
  durationSeconds: number;
};

const ZERO_METRICS: MatchActualMetrics = {
  totalDistance: 0,
  hsr: 0,
  sprint: 0,
  accelerations: 0,
  decelerations: 0,
  durationSeconds: 0,
};

/**
 * Convert a GPS_Log[Duration] Execute Queries cell to seconds.
 *
 * Live Power BI REST serialization observed for this DateTime column:
 * ISO datetime on the Excel epoch date, e.g. `1899-12-30T00:50:52`.
 * The clock time is the duration (not a wall-clock match kickoff).
 *
 * Invalid / unparseable values return null — callers must not coerce to 0.
 */
export function parseGpsLogDurationToSeconds(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return clockTimeToSeconds(
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
      value.getUTCMilliseconds()
    );
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    // Excel/Power BI DateTime serial as fraction of a day (duration < 36h).
    if (value < 1.5) {
      return Math.round(value * 86400 * 1000) / 1000;
    }
    return null;
  }

  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const iso = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:Z)?$/.exec(
    trimmed
  );
  if (iso) {
    const hours = Number(iso[2]);
    const minutes = Number(iso[3]);
    const seconds = Number(iso[4]);
    const fraction = iso[5] ? Number(`0.${iso[5]}`) : 0;
    return clockTimeToSeconds(hours, minutes, seconds, fraction * 1000);
  }

  const hms = /^(\d{1,3}):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(trimmed);
  if (hms) {
    return clockTimeToSeconds(
      Number(hms[1]),
      Number(hms[2]),
      Number(hms[3]),
      hms[4] ? Number(`0.${hms[4]}`) * 1000 : 0
    );
  }

  const ms = /^(\d{1,3}):(\d{2})$/.exec(trimmed);
  if (ms) {
    return clockTimeToSeconds(0, Number(ms[1]), Number(ms[2]), 0);
  }

  return null;
}

function clockTimeToSeconds(
  hours: number,
  minutes: number,
  seconds: number,
  milliseconds: number
): number | null {
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    !Number.isFinite(milliseconds) ||
    hours < 0 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59 ||
    milliseconds < 0
  ) {
    return null;
  }
  const total = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  return Number.isFinite(total) ? total : null;
}

function mapValidHalfRow(
  row: Record<string, unknown>
): MatchActualHalfMetrics | null {
  const totalDistance = toNullableNumber(pickRowValue(row, "TD"));
  const hsr = toNullableNumber(pickRowValue(row, "Z5"));
  const sprint = toNullableNumber(pickRowValue(row, "Z6"));
  const accelerations = toNullableNumber(pickRowValue(row, "Acc"));
  const decelerations = toNullableNumber(pickRowValue(row, "Dec"));
  const durationSeconds = parseGpsLogDurationToSeconds(
    pickRowValue(row, "Duration")
  );

  if (
    totalDistance === null ||
    hsr === null ||
    sprint === null ||
    accelerations === null ||
    decelerations === null ||
    durationSeconds === null
  ) {
    return null;
  }

  return {
    totalDistance,
    hsr,
    sprint,
    accelerations,
    decelerations,
    durationSeconds,
  };
}

function cardinality(rows: Record<string, unknown>[]): MatchHalfCardinality {
  if (rows.length === 0) return "absent";
  if (rows.length === 1) return "valid";
  return "ambiguous";
}

function addMetrics(
  a: MatchActualMetrics,
  b: MatchActualMetrics
): MatchActualMetrics {
  return {
    totalDistance: a.totalDistance + b.totalDistance,
    hsr: a.hsr + b.hsr,
    sprint: a.sprint + b.sprint,
    accelerations: a.accelerations + b.accelerations,
    decelerations: a.decelerations + b.decelerations,
    durationSeconds: a.durationSeconds + b.durationSeconds,
  };
}

/**
 * Classify raw (non-aggregated) Team match half rows per requested frozen player.
 * 0 rows → absent; 1 → valid; >1 → ambiguous. Players are independent.
 * Both halves absent → match_zero (valid zeros). Either half >1 → match_ambiguous.
 */
export function classifyMatchActualRowsByPlayer(
  requestedPlayerNames: string[],
  rows: Record<string, unknown>[]
): Map<string, MatchActualPlayerResult> {
  const grouped = new Map<
    string,
    { first: Record<string, unknown>[]; second: Record<string, unknown>[] }
  >();

  for (const row of rows) {
    const player = pickRowValue(row, "Player");
    if (typeof player !== "string") continue;
    const drill = pickRowValue(row, "Drill");
    if (drill !== MATCH_ACTUAL_FIRST_HALF && drill !== MATCH_ACTUAL_SECOND_HALF) {
      continue;
    }
    const bucket = grouped.get(player) ?? { first: [], second: [] };
    if (drill === MATCH_ACTUAL_FIRST_HALF) bucket.first.push(row);
    else bucket.second.push(row);
    grouped.set(player, bucket);
  }

  const out = new Map<string, MatchActualPlayerResult>();
  for (const playerName of requestedPlayerNames) {
    const halves = grouped.get(playerName) ?? { first: [], second: [] };
    const first = cardinality(halves.first);
    const second = cardinality(halves.second);

    if (first === "ambiguous" || second === "ambiguous") {
      out.set(playerName, {
        playerName,
        quality: "match_ambiguous",
        halves: { first, second },
        metrics: null,
      });
      continue;
    }

    const firstMetrics =
      first === "valid" ? mapValidHalfRow(halves.first[0]) : { ...ZERO_METRICS };
    const secondMetrics =
      second === "valid" ? mapValidHalfRow(halves.second[0]) : { ...ZERO_METRICS };

    if (firstMetrics === null || secondMetrics === null) {
      out.set(playerName, {
        playerName,
        quality: "data_issue",
        halves: { first, second },
        metrics: null,
      });
      continue;
    }

    if (first === "absent" && second === "absent") {
      out.set(playerName, {
        playerName,
        quality: "match_zero",
        halves: { first, second },
        metrics: { ...ZERO_METRICS },
      });
      continue;
    }

    out.set(playerName, {
      playerName,
      quality: "match_ok",
      halves: { first, second },
      metrics: addMetrics(firstMetrics, secondMetrics),
    });
  }

  return out;
}
