import { describe, expect, it } from "vitest";
import { buildDrillAnalysisModel } from "@/lib/drillAnalysis/assemble";
import { formatDrillMetric, formatDurationMinutes } from "@/lib/drillAnalysis/format";
import { historyDetailFromModel } from "@/lib/drillAnalysis/history";
import { buildSessionKey } from "@/lib/drillAnalysis/keys";
import { buildOccurrences, emptyMetrics } from "@/lib/drillAnalysis/metrics";
import {
  arrangePlanItems,
  estimateDrillLoad,
  parsePlanRequest,
  snapshotFromHistoryModel,
  type PlanItemSnapshot,
  type StoredPlanItem,
} from "@/lib/drillAnalysis/trainingPlan";
import type { DrillMetrics, ParsedDrillRow, SessionRef } from "@/lib/drillAnalysis/types";

const session: SessionRef = { date: "2026-11-05", weekId: "W17", mdTag: "MD-3", sessionType: "Team" };
const cardId = "55555555-5555-5555-5555-555555555555";

function metrics(partial: Partial<DrillMetrics> = {}): DrillMetrics {
  return { ...emptyMetrics(), ...partial };
}

function row(input: {
  player: string;
  drill: string;
  start?: string;
  durationSeconds?: number | null;
  metrics?: Partial<DrillMetrics>;
}): ParsedDrillRow {
  const start = input.start ?? "10:00:00";
  return {
    player: input.player,
    drill: input.drill,
    startToken: start,
    startLabel: start,
    startParsed: true,
    durationSeconds: input.durationSeconds ?? null,
    sourceRows: 1,
    metrics: metrics(input.metrics),
  };
}

function modelFor(rows: ParsedDrillRow[], keys?: string[]) {
  const built = buildOccurrences(session, rows);
  const ordered = keys ?? built.occurrences.map((item) => item.key);
  return buildDrillAnalysisModel({
    session,
    occurrences: built.occurrences,
    savedCards: keys
      ? [{ id: cardId, displayName: "Block", sortIndex: 0, imagePath: null, occurrenceKeys: ordered }]
      : [],
    player: null,
    excludedBlankDrillRows: 0,
    excludedBlankPlayerRows: 0,
  });
}

describe("training plan snapshot", () => {
  it("copies every set in saved order with the history team averages", () => {
    const rows = [
      row({ player: "A", drill: "10v10 - SET 1", start: "13:00:00", durationSeconds: 13 * 60 + 20, metrics: { totalDistance: 100, hsr: 0, accelerations: 4 } }),
      row({ player: "B", drill: "10v10 - SET 1", start: "13:00:00", durationSeconds: 13 * 60 + 20, metrics: { totalDistance: 140, hsr: null, accelerations: null } }),
      row({ player: "A", drill: "10v10 - SET 2", start: "13:16:00", durationSeconds: 10 * 60, metrics: { totalDistance: 80, hsr: 5, accelerations: 2 } }),
      row({ player: "A", drill: "10v10 - SET 3", start: "13:30:00", durationSeconds: 9 * 60 + 10, metrics: { totalDistance: 50, hsr: 1, accelerations: 1 } }),
    ];
    const built = buildOccurrences(session, rows);
    const keys = ["SET 2", "SET 1", "SET 3"].map((name) => built.occurrences.find((item) => item.drill.endsWith(name))!.key);
    const model = modelFor(rows, keys);
    const detail = historyDetailFromModel(model, cardId);
    const snapshot = snapshotFromHistoryModel(model, cardId, "Keep the width");
    expect(snapshot?.sets.map((set) => set.drillName)).toEqual(detail?.sets.map((set) => set.label));
    expect(snapshot?.sets).toHaveLength(3);
    expect(snapshot?.title).toBe(detail?.title);
    expect(snapshot?.displayName).toBe("Block");
    expect(snapshot?.note).toBe("Keep the width");
    expect(snapshot?.sourceDate).toBe("2026-11-05");
    const distance = snapshot?.sets.map((set) => formatDrillMetric(set.metrics.totalDistance, "m"));
    expect(distance).toEqual(detail?.metrics.find((metric) => metric.key === "totalDistance")?.values);
    expect(snapshot?.sets[1]?.metrics.hsr).toBe(0);
    expect(formatDrillMetric(snapshot?.sets[1]?.metrics.hsr ?? null, "m")).toBe("0 m");
    expect(snapshot?.sets[1]?.metrics.accelerations).toBe(4);
    expect(snapshot?.sets[0]?.durationMinutes).toBe(10);
    expect(formatDurationMinutes(snapshot?.sets[0]?.durationMinutes ?? null)).toBe(detail?.sets[0]?.duration);
  });

  it("does not accept Full Training as a drill", () => {
    const model = modelFor([
      row({ player: "A", drill: "Full Training", metrics: { totalDistance: 7000 } }),
    ]);
    expect(model.cards.find((card) => card.columns.some((column) => column.label === "Full Training"))).toBeUndefined();
    expect(snapshotFromHistoryModel(model, "ungrouped:missing", "")).toBeNull();
  });
});

describe("training plan estimate", () => {
  it("adds each set once and keeps a missing value out of the sum", () => {
    const first = sample("one", [
      set({ totalDistance: 100, tempoDistance: 0, hsr: null, sprintDistance: 10, accelerations: 4, decelerations: 3, distancePerMin: 80 }, 12),
      set({ totalDistance: 40, tempoDistance: 5, hsr: 8, sprintDistance: null, accelerations: 1, decelerations: 0, distancePerMin: 90 }, 8),
    ]);
    const estimate = estimateDrillLoad([first]);
    expect(estimate.metrics.totalDistance).toEqual({ total: 140, partial: false });
    expect(estimate.metrics.tempoDistance).toEqual({ total: 5, partial: false });
    expect(estimate.metrics.decelerations).toEqual({ total: 3, partial: false });
    expect(estimate.metrics.hsr).toEqual({ total: 8, partial: true });
    expect(estimate.metrics.sprintDistance).toEqual({ total: 10, partial: true });
    expect(estimate.metrics.accelerations).toEqual({ total: 5, partial: false });
    expect(estimate.duration).toEqual({ total: 20, partial: false });
    expect(estimate.metrics).not.toHaveProperty("distancePerMin");
  });

  it("does not turn a missing duration into zero or parse a display label", () => {
    const item = sample("gap", [set({ totalDistance: 10 }, null), set({ totalDistance: 15 }, 6)]);
    expect(estimateDrillLoad([item]).duration).toEqual({ total: 6, partial: true });
    expect(estimateDrillLoad([sample("empty", [set({ totalDistance: null }, null)])]).metrics.totalDistance).toEqual({
      total: null,
      partial: true,
    });
  });
});

describe("training plan save arrangement", () => {
  it("keeps a stored snapshot when the same drill is saved again", () => {
    const stored = storedItem("kept", 100);
    const fresh = sample("kept", [set({ totalDistance: 999 }, 1)]);
    const sessionKey = buildSessionKey(session);
    const arranged = arrangePlanItems(
      [stored],
      [{ sourceSessionKey: sessionKey, sourceEntryId: cardId }],
      new Map([[`${sessionKey}\n${cardId}`, { snapshot: fresh, sourceImagePath: "cards/new" }]])
    );
    expect(arranged.ok).toBe(true);
    if (!arranged.ok) return;
    expect(arranged.plan.kept[0]?.snapshot.sets[0]?.metrics.totalDistance).toBe(100);
    expect(arranged.plan.created).toHaveLength(0);
    expect(arranged.plan.kept[0]?.sortIndex).toBe(0);
  });

  it("rejects a duplicate add and a client-supplied measurement", () => {
    const sessionKey = buildSessionKey(session);
    const duplicate = arrangePlanItems(
      [],
      [
        { sourceSessionKey: sessionKey, sourceEntryId: cardId },
        { sourceSessionKey: sessionKey, sourceEntryId: cardId },
      ],
      new Map()
    );
    expect(duplicate).toEqual({ ok: false, error: "This drill is already in the plan." });
    const request = parsePlanRequest({
      name: "MD plan",
      planDate: "2026-11-12",
      notes: "",
      items: [{ sourceSessionKey: sessionKey, sourceEntryId: cardId, metrics: { totalDistance: 1 } }],
    });
    expect(request.ok).toBe(true);
    if (!request.ok) return;
    expect(request.items[0]).toEqual({ sourceSessionKey: sessionKey, sourceEntryId: cardId });
    expect(request.items[0]).not.toHaveProperty("metrics");
  });
});

function set(partial: Partial<DrillMetrics>, durationMinutes: number | null) {
  return {
    occurrenceKey: "set",
    drillName: "Drill",
    durationMinutes,
    metrics: metrics(partial),
  };
}

function sample(name: string, sets: PlanItemSnapshot["sets"]): PlanItemSnapshot {
  return {
    sourceSessionKey: "session",
    sourceEntryId: name,
    sourceDate: "2026-11-05",
    sessionLabel: "W17 · MD-3 · Team",
    title: name,
    displayName: "",
    note: "",
    sets,
  };
}

function storedItem(name: string, totalDistance: number): StoredPlanItem {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    sourceSessionKey: buildSessionKey(session),
    sourceEntryId: cardId,
    imagePath: `plans/22222222-2222-2222-2222-222222222222/11111111-1111-1111-1111-111111111111.jpg`,
    snapshot: sample(name, [set({ totalDistance }, 12)]),
  };
}
