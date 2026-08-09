/**
 * Client-safe GPS Planner shared types (no server-only).
 * Domain modules and UI import from here — do not re-export these from "use server" actions.
 */

import type {
  AbsoluteMetrics,
  MatchBestMetrics,
  PercentageMetrics,
} from "@/lib/gpsPlanner/calculations";
import type {
  OverloadFocusMetric,
  PlannerWeekStatus,
  PlannerWeekType,
} from "@/lib/gpsPlanner/common";

export type PlannerWeekRow = {
  id: string;
  powerbiWeekId: string;
  startDate: string;
  endDate: string;
  weekType: PlannerWeekType;
  overloadFocus: OverloadFocusMetric[];
  status: PlannerWeekStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlannerWeekDayRow = {
  id: string;
  weekId: string;
  date: string;
  mdTag: string;
  displayOrder: number;
  createdAt: string;
};

export type PlannerGroupRow = {
  id: string;
  weekId: string;
  name: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlannerGroupMemberRow = {
  groupId: string;
  playerId: string;
  addedAt: string;
  addedBy: string | null;
  playerDisplayName: string;
};

export type PlannerMatchBestSnapshot = {
  weekId: string;
  playerId: string;
  tdBest: number;
  hsrBest: number;
  sprintBest: number;
  accBest: number;
  decBest: number;
  powerBiPlayerName: string;
  sourceMethod: string;
  createdAt: string;
  createdBy: string | null;
};

export type PlannerWeeklyTargetView = {
  weekId: string;
  playerId: string;
  playerDisplayName: string;
  tdPct: number;
  hsrPct: number;
  sprintPct: number;
  accPct: number;
  decPct: number;
  tdBest: number;
  hsrBest: number;
  sprintBest: number;
  accBest: number;
  decBest: number;
  powerBiPlayerName: string;
  sourceMethod: string;
  totalDistance: number;
  hsr: number;
  sprint: number;
  accelerations: number;
  decelerations: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type PlannerDailyTargetView = {
  weekId: string;
  weekDayId: string;
  date: string;
  mdTag: string;
  playerId: string;
  playerDisplayName: string;
  tdPct: number;
  hsrPct: number;
  sprintPct: number;
  accPct: number;
  decPct: number;
  tdBest: number;
  hsrBest: number;
  sprintBest: number;
  accBest: number;
  decBest: number;
  powerBiPlayerName: string;
  totalDistance: number;
  hsr: number;
  sprint: number;
  accelerations: number;
  decelerations: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type DayActualStatus =
  | "actual_found"
  | "actual_not_found"
  | "actual_ambiguous"
  | "actual_error"
  | "actual_incomplete";

export type WeeklyProgressDayActual = {
  weekDayId: string;
  date: string;
  mdTag: string;
  status: DayActualStatus;
  actual: AbsoluteMetrics | null;
  hasDailyTarget: boolean;
};

export type PlannerWeeklyProgressResult = {
  weekId: string;
  powerBiWeekId: string;
  playerId: string;
  playerDisplayName: string;
  throughDate: string;
  frozen: MatchBestMetrics & { powerBiPlayerName: string; sourceMethod: string };
  weeklyPct: PercentageMetrics;
  weeklyPlanned: AbsoluteMetrics;
  dailyAllocationSum: PercentageMetrics;
  remainingToAllocate: PercentageMetrics;
  days: WeeklyProgressDayActual[];
  includedDays: number;
  foundDays: number;
  notFoundDays: number;
  problematicDays: number;
  weeklyActual: AbsoluteMetrics | null;
  weeklyToTarget: AbsoluteMetrics | null;
  actualCompleteness: "complete" | "partial_not_found" | "incomplete";
};

export type PlannerUiPlayer = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type ApplyWeeklyTargetOutcome = {
  playerId: string;
  status: "created" | "updated" | "failed";
  message?: string;
};

/** Same per-player outcome shape as weekly apply. */
export type ApplyDailyTargetOutcome = ApplyWeeklyTargetOutcome;

/** Current ST-AMS ↔ Power BI mapping row (display). */
export type PlayerExternalMappingRow = {
  id: string;
  playerId: string;
  provider: "powerbi";
  externalPlayerName: string;
  createdAt: string;
  updatedAt: string;
  playerDisplayName: string;
};

/** One player row on the printable Daily Plan (client-safe). */
export type DailyPlanPrintPlayerRow = {
  playerId: string;
  playerDisplayName: string;
  hasDailyTarget: boolean;
  /** Absolute planned TD (m). Null when hasDailyTarget is false — not zero. */
  totalDistance: number | null;
  hsr: number | null;
  sprint: number | null;
  accelerations: number | null;
  decelerations: number | null;
};

/** Daily Plan print payload (client-safe). No Actual / Match Best / Difference. */
export type DailyPlanPrintResult = {
  weekDayId: string;
  weekId: string;
  powerBiWeekId: string;
  date: string;
  mdTag: string;
  /** Ordered as requested playerIds. */
  players: DailyPlanPrintPlayerRow[];
};
