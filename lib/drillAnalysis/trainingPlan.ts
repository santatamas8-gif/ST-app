import { reportHeadings } from "@/lib/drillAnalysis/format";
import { isHistoryNoteEntry } from "@/lib/drillAnalysis/historyNote";
import { isFullTrainingDrill } from "@/lib/drillAnalysis/metrics";
import {
  DRILL_METRICS,
  type DrillAnalysisModel,
  type DrillMetricKey,
  type DrillMetrics,
} from "@/lib/drillAnalysis/types";

export const PLAN_NAME_MAX = 120;
export const PLAN_NOTES_MAX = 2000;
export const PLAN_ITEM_MAX = 40;

/** Metrics that are added once per selected set. Distance per minute is never included. */
export const PLAN_SUM_METRICS = [
  "totalDistance",
  "tempoDistance",
  "hsr",
  "sprintDistance",
  "accelerations",
  "decelerations",
] as const satisfies readonly DrillMetricKey[];

export type PlanSumMetric = (typeof PLAN_SUM_METRICS)[number];

export type PlanSetSnapshot = {
  occurrenceKey: string;
  drillName: string;
  durationMinutes: number | null;
  metrics: DrillMetrics;
};

/** Frozen team-average values for one History card. Later source edits do not rewrite this. */
export type PlanItemSnapshot = {
  sourceSessionKey: string;
  sourceEntryId: string;
  sourceDate: string;
  sessionLabel: string;
  title: string;
  displayName: string;
  note: string;
  sets: PlanSetSnapshot[];
};

export type PlanMetricTotal = {
  total: number | null;
  partial: boolean;
};

export type PlanEstimate = {
  metrics: Record<PlanSumMetric, PlanMetricTotal>;
  duration: PlanMetricTotal;
};

export type StoredPlanItem = {
  id: string;
  sourceSessionKey: string;
  sourceEntryId: string;
  snapshot: PlanItemSnapshot;
  imagePath: string | null;
};

export type FreshPlanItem = {
  snapshot: PlanItemSnapshot;
  sourceImagePath: string | null;
};

export type ArrangedPlanItems = {
  kept: Array<StoredPlanItem & { sortIndex: number }>;
  created: Array<{ sourceSessionKey: string; sourceEntryId: string; sortIndex: number; fresh: FreshPlanItem }>;
  removed: StoredPlanItem[];
};

const SUM_LABEL: Record<PlanSumMetric, string> = {
  totalDistance: "TD",
  tempoDistance: "Tempo",
  hsr: "HSR",
  sprintDistance: "Sprint",
  accelerations: "Acc",
  decelerations: "Dec",
};

export function planMetricLabel(key: PlanSumMetric): string {
  return SUM_LABEL[key];
}

export function planSourceKey(sessionKey: string, entryId: string): string {
  return `${sessionKey}\n${entryId}`;
}

export function snapshotFromHistoryModel(
  model: DrillAnalysisModel,
  cardId: string,
  note: string
): PlanItemSnapshot | null {
  const card = model.cards.find((item) => item.id === cardId);
  if (!card) return null;
  const columns = card.columns.filter((column) => !column.missing);
  if (columns.length === 0) return null;
  if (columns.some((column) => isFullTrainingDrill(column.label))) return null;
  const labels = columns.map((column) => column.label);
  return {
    sourceSessionKey: model.sessionKey,
    sourceEntryId: card.id,
    sourceDate: model.session.date,
    sessionLabel: model.sessionLabel,
    title: planCardTitle(card.persisted ? card.displayName : "", labels),
    displayName: card.persisted ? card.displayName : "",
    note: note.trim(),
    sets: columns.map((column) => ({
      occurrenceKey: column.occurrenceKey,
      drillName: column.label,
      durationMinutes: column.durationMinutes,
      metrics: { ...column.metrics },
    })),
  };
}

/**
 * Sum each selected set once. A missing value stays missing and marks that total partial.
 * Zero is a real measurement. Distance per minute is not summed.
 * Duration uses the stored whole minutes, never the formatted label.
 */
export function estimateDrillLoad(items: PlanItemSnapshot[]): PlanEstimate {
  const sets = items.flatMap((item) => item.sets);
  const metrics = {} as Record<PlanSumMetric, PlanMetricTotal>;
  for (const key of PLAN_SUM_METRICS) {
    const values = sets.map((set) => set.metrics[key]);
    metrics[key] = totalOf(values);
  }
  return {
    metrics,
    duration: totalOf(sets.map((set) => set.durationMinutes)),
  };
}

export function arrangePlanItems(
  existing: StoredPlanItem[],
  requested: { sourceSessionKey: string; sourceEntryId: string }[],
  fresh: Map<string, FreshPlanItem>
): { ok: true; plan: ArrangedPlanItems } | { ok: false; error: string } {
  if (requested.length > PLAN_ITEM_MAX) {
    return { ok: false, error: `A plan can hold up to ${PLAN_ITEM_MAX} drills.` };
  }
  const seen = new Set<string>();
  for (const item of requested) {
    if (!isHistoryNoteEntry(item.sourceSessionKey, item.sourceEntryId)) {
      return { ok: false, error: "Drill not found." };
    }
    const key = planSourceKey(item.sourceSessionKey, item.sourceEntryId);
    if (seen.has(key)) return { ok: false, error: "This drill is already in the plan." };
    seen.add(key);
  }

  const stored = new Map(existing.map((item) => [planSourceKey(item.sourceSessionKey, item.sourceEntryId), item]));
  const kept: ArrangedPlanItems["kept"] = [];
  const created: ArrangedPlanItems["created"] = [];
  requested.forEach((item, sortIndex) => {
    const key = planSourceKey(item.sourceSessionKey, item.sourceEntryId);
    const previous = stored.get(key);
    if (previous) {
      kept.push({ ...previous, sortIndex });
      return;
    }
    const captured = fresh.get(key);
    if (!captured) return;
    created.push({
      sourceSessionKey: item.sourceSessionKey,
      sourceEntryId: item.sourceEntryId,
      sortIndex,
      fresh: captured,
    });
  });
  if (kept.length + created.length !== requested.length) {
    return { ok: false, error: "Drill not found." };
  }
  const requestedKeys = new Set(requested.map((item) => planSourceKey(item.sourceSessionKey, item.sourceEntryId)));
  return {
    ok: true,
    plan: {
      kept,
      created,
      removed: existing.filter((item) => !requestedKeys.has(planSourceKey(item.sourceSessionKey, item.sourceEntryId))),
    },
  };
}

export function parsePlanSnapshot(value: unknown): PlanItemSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.sourceSessionKey !== "string" || typeof row.sourceEntryId !== "string") return null;
  if (!isHistoryNoteEntry(row.sourceSessionKey, row.sourceEntryId)) return null;
  if (typeof row.sourceDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.sourceDate)) return null;
  if (typeof row.sessionLabel !== "string" || typeof row.title !== "string" || typeof row.displayName !== "string") return null;
  if (typeof row.note !== "string" || row.note.length > PLAN_NOTES_MAX) return null;
  if (!Array.isArray(row.sets) || row.sets.length === 0 || row.sets.length > 12) return null;
  const sets: PlanSetSnapshot[] = [];
  for (const set of row.sets) {
    const parsed = parseSet(set);
    if (!parsed) return null;
    if (isFullTrainingDrill(parsed.drillName)) return null;
    sets.push(parsed);
  }
  return {
    sourceSessionKey: row.sourceSessionKey,
    sourceEntryId: row.sourceEntryId,
    sourceDate: row.sourceDate,
    sessionLabel: row.sessionLabel,
    title: row.title,
    displayName: row.displayName,
    note: row.note,
    sets,
  };
}

export function parsePlanRequest(value: unknown): { ok: true; name: string; planDate: string; notes: string | null; items: { sourceSessionKey: string; sourceEntryId: string }[] } | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "The plan could not be saved." };
  const body = value as Record<string, unknown>;
  if (typeof body.name !== "string") return { ok: false, error: "Enter a plan name." };
  const name = body.name.trim();
  if (!name || name.length > PLAN_NAME_MAX) return { ok: false, error: "Enter a plan name of 120 characters or fewer." };
  if (typeof body.planDate !== "string" || !isIsoDate(body.planDate)) return { ok: false, error: "Enter a plan date." };
  if (body.notes != null && typeof body.notes !== "string") return { ok: false, error: "The plan could not be saved." };
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (notes.length > PLAN_NOTES_MAX) return { ok: false, error: "Notes must be 2000 characters or fewer." };
  if (!Array.isArray(body.items)) return { ok: false, error: "Add at least one drill." };
  const items: { sourceSessionKey: string; sourceEntryId: string }[] = [];
  for (const item of body.items) {
    if (!item || typeof item !== "object") return { ok: false, error: "Drill not found." };
    const row = item as Record<string, unknown>;
    if (typeof row.sourceSessionKey !== "string" || typeof row.sourceEntryId !== "string") {
      return { ok: false, error: "Drill not found." };
    }
    items.push({ sourceSessionKey: row.sourceSessionKey, sourceEntryId: row.sourceEntryId });
  }
  if (items.length === 0) return { ok: false, error: "Add at least one drill." };
  return { ok: true, name, planDate: body.planDate, notes: notes.length === 0 ? null : notes, items };
}

function planCardTitle(displayName: string, drills: string[]): string {
  const headings = reportHeadings(displayName, drills);
  if (headings.title.trim()) return headings.title;
  const unique = [...new Set(drills.map((drill) => drill.trim()).filter(Boolean))];
  if (unique.length === 0) return "Drill";
  if (unique.length === 1) return unique[0];
  return unique.join(" · ");
}

function totalOf(values: Array<number | null>): PlanMetricTotal {
  const partial = values.some((value) => value === null || !Number.isFinite(value));
  const present = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (present.length === 0) return { total: null, partial: true };
  return { total: present.reduce((sum, value) => sum + value, 0), partial };
}

function parseSet(value: unknown): PlanSetSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.occurrenceKey !== "string" || typeof row.drillName !== "string" || !row.drillName.trim()) return null;
  if (!wholeOrNull(row.durationMinutes)) return null;
  if (!row.metrics || typeof row.metrics !== "object") return null;
  const metrics = {} as DrillMetrics;
  for (const metric of DRILL_METRICS) {
    const number = (row.metrics as Record<string, unknown>)[metric.key];
    if (!wholeOrNull(number)) return null;
    metrics[metric.key] = number;
  }
  return {
    occurrenceKey: row.occurrenceKey,
    drillName: row.drillName,
    durationMinutes: row.durationMinutes,
    metrics,
  };
}

function wholeOrNull(value: unknown): value is number | null {
  if (value === null) return true;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1_000_000;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
