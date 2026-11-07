import { describe, expect, it } from "vitest";
import { buildDrillAnalysisModel } from "@/lib/drillAnalysis/assemble";
import { formatDrillMetric } from "@/lib/drillAnalysis/format";
import { buildHistoryCards, historyDetailFromModel } from "@/lib/drillAnalysis/history";
import { filterHistoryEntries, type HistoryEntry } from "@/lib/drillAnalysis/historySearch";
import { buildSessionKey } from "@/lib/drillAnalysis/keys";
import { buildOccurrences, emptyMetrics } from "@/lib/drillAnalysis/metrics";
import { buildDrillHistoryIdentityDax } from "@/lib/drillAnalysis/query";
import type { DrillMetrics, ParsedDrillRow, SavedDrillCard, SessionRef } from "@/lib/drillAnalysis/types";

const newer: SessionRef = { date: "2026-11-05", weekId: "W17", mdTag: "MD-3", sessionType: "Team" };
const older: SessionRef = { date: "2026-11-04", weekId: "W17", mdTag: "MD-4", sessionType: "Team" };

function metrics(partial: Partial<DrillMetrics> = {}): DrillMetrics {
  return { ...emptyMetrics(), ...partial };
}

function drillRow(input: {
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

function cardsFor(session: SessionRef, rows: ParsedDrillRow[], savedCards: SavedDrillCard[] = []) {
  const built = buildOccurrences(session, rows);
  return {
    built,
    cards: buildHistoryCards([
      {
        session,
        sessionKey: buildSessionKey(session),
        occurrences: built.occurrences,
        savedCards,
      },
    ]),
  };
}

describe("drill history catalog", () => {
  it("keeps the identity query free of metric aggregation", () => {
    const dax = buildDrillHistoryIdentityDax();
    expect(dax).toContain("GPS_Log[Drill Start Time]");
    expect(dax).toContain("GPS_Log[Drill]");
    expect(dax).not.toContain("SUM(");
    expect(dax).not.toContain("AVERAGE(");
    expect(dax).not.toContain("GPS_Log[TD]");
    expect(dax).toContain("GPS_Log[Duration]");
  });

  it("shows each set duration on the card without adding them together", () => {
    const single = cardsFor(newer, [
      drillRow({ player: "A", drill: "Warm up", durationSeconds: 11 * 60 + 40 }),
      drillRow({ player: "B", drill: "Warm up", durationSeconds: 11 * 60 + 40 }),
    ]);
    expect(single.cards[0]?.duration).toBe("12 min");

    const rows = [
      drillRow({ player: "A", drill: "10v10 - SET1", start: "13:00:00", durationSeconds: 13 * 60 + 5 }),
      drillRow({ player: "A", drill: "10v10 - SET2", start: "13:16:00", durationSeconds: 10 * 60 + 6 }),
    ];
    const built = buildOccurrences(newer, rows);
    const set1 = built.occurrences.find((item) => item.drill.endsWith("SET1"));
    const set2 = built.occurrences.find((item) => item.drill.endsWith("SET2"));
    const grouped = cardsFor(newer, rows, [
      {
        id: "66666666-6666-6666-6666-666666666666",
        displayName: "",
        sortIndex: 0,
        imagePath: null,
        occurrenceKeys: [set1!.key, set2!.key],
      },
    ]);
    expect(grouped.cards[0]?.duration).toBe("13 min · 10 min");
  });

  it("lists the same drill on different dates as separate cards, newest first", () => {
    const cards = buildHistoryCards([
      {
        session: older,
        sessionKey: buildSessionKey(older),
        occurrences: buildOccurrences(older, [drillRow({ player: "A", drill: "Warm up" })]).occurrences,
        savedCards: [],
      },
      {
        session: newer,
        sessionKey: buildSessionKey(newer),
        occurrences: buildOccurrences(newer, [drillRow({ player: "A", drill: "Warm up" })]).occurrences,
        savedCards: [],
      },
    ]);
    expect(cards.map((card) => card.date)).toEqual(["2026-11-05", "2026-11-04"]);
    expect(cards.map((card) => card.title)).toEqual(["Warm up", "Warm up"]);
    expect(new Set(cards.map((card) => card.id)).size).toBe(2);
    expect(cards.every((card) => card.hasImage === false)).toBe(true);
  });

  it("shows one saved group and does not repeat its sets or Full Training", () => {
    const rows = [
      drillRow({ player: "A", drill: "10v10 105x65 - SET1", start: "13:00:00" }),
      drillRow({ player: "A", drill: "10v10 105x65 - SET2", start: "13:16:00" }),
      drillRow({ player: "A", drill: "Recovery Sprint", start: "12:26:00" }),
      drillRow({ player: "A", drill: "Full Training", start: "12:13:00" }),
    ];
    const { built } = cardsFor(newer, rows);
    const set1 = built.occurrences.find((item) => item.drill.endsWith("SET1"));
    const set2 = built.occurrences.find((item) => item.drill.endsWith("SET2"));
    expect(set1 && set2).toBeTruthy();
    const grouped = cardsFor(newer, rows, [
      {
        id: "11111111-1111-1111-1111-111111111111",
        displayName: "",
        sortIndex: 0,
        imagePath: "scope/card.png",
        occurrenceKeys: [set2!.key, set1!.key],
      },
    ]).cards;

    expect(grouped).toHaveLength(2);
    const group = grouped.find((card) => card.id === "11111111-1111-1111-1111-111111111111");
    expect(group).toMatchObject({ title: "10v10 105x65", setCount: 2, hasImage: true });
    expect(grouped.some((card) => card.title === "Recovery Sprint" && card.hasImage === false)).toBe(true);
    expect(grouped.some((card) => card.title === "Full Training")).toBe(false);
    expect(grouped.some((card) => card.id === `ungrouped:${set1!.key}`)).toBe(false);
    expect(grouped.some((card) => card.id === `ungrouped:${set2!.key}`)).toBe(false);
  });

  it("does not borrow an image from the same drill on another date", () => {
    const withImage = cardsFor(older, [drillRow({ player: "A", drill: "Warm up" })]);
    const saved: SavedDrillCard = {
      id: "22222222-2222-2222-2222-222222222222",
      displayName: "Warm up",
      sortIndex: 0,
      imagePath: "scope/warm.png",
      occurrenceKeys: [withImage.built.occurrences[0].key],
    };
    const cards = buildHistoryCards([
      {
        session: older,
        sessionKey: buildSessionKey(older),
        occurrences: withImage.built.occurrences,
        savedCards: [saved],
      },
      {
        session: newer,
        sessionKey: buildSessionKey(newer),
        occurrences: buildOccurrences(newer, [drillRow({ player: "A", drill: "Warm up" })]).occurrences,
        savedCards: [],
      },
    ]);
    expect(cards.find((card) => card.date === "2026-11-04")?.hasImage).toBe(true);
    expect(cards.find((card) => card.date === "2026-11-05")?.hasImage).toBe(false);
  });

  it("still lists a drill when its saved card points at a missing occurrence", () => {
    const { cards } = cardsFor(newer, [drillRow({ player: "A", drill: "Warm up" })], [
      {
        id: "33333333-3333-3333-3333-333333333333",
        displayName: "Gone",
        sortIndex: 0,
        imagePath: null,
        occurrenceKeys: ["missing-key"],
      },
    ]);
    expect(cards.map((card) => card.title)).toEqual(["Warm up"]);
    expect(cards[0].id.startsWith("ungrouped:")).toBe(true);
  });

  it("searches original names across the whole catalog", () => {
    const entries: HistoryEntry[] = [
      entry("Warm up"),
      entry("10v0 rondo"),
      entry("10v10 Actions"),
      ...Array.from({ length: 27 }, (_, index) => entry(`Passing ${index}`)),
    ];
    expect(filterHistoryEntries(entries, "").length).toBe(30);
    expect(filterHistoryEntries(entries, "warm up").map((item) => item.title)).toEqual(["Warm up"]);
    expect(filterHistoryEntries(entries, "10v").map((item) => item.title)).toEqual(["10v0 rondo", "10v10 Actions"]);
    expect(filterHistoryEntries(entries, "10v")[1]).toBe(entries[2]);

    const { built, cards } = cardsFor(newer, [
      drillRow({ player: "A", drill: "10v10 Actions - SET1", start: "13:00:00" }),
      drillRow({ player: "A", drill: "10v10 Actions - SET2", start: "13:10:00" }),
    ]);
    const grouped = cardsFor(newer, [
      drillRow({ player: "A", drill: "10v10 Actions - SET1", start: "13:00:00" }),
      drillRow({ player: "A", drill: "10v10 Actions - SET2", start: "13:10:00" }),
    ], [
      {
        id: "44444444-4444-4444-4444-444444444444",
        displayName: "Block",
        sortIndex: 0,
        imagePath: null,
        occurrenceKeys: built.occurrences.map((item) => item.key),
      },
    ]).cards;
    expect(grouped).toHaveLength(1);
    expect(filterHistoryEntries(grouped, "10v")).toEqual(grouped);
    expect(filterHistoryEntries(grouped, "block")).toEqual(grouped);
    expect(cards).toHaveLength(2);
  });
});

describe("drill history detail", () => {
  it("uses team averages and keeps a missing value blank", () => {
    const rows = [
      drillRow({
        player: "A",
        drill: "Warm up",
        durationSeconds: 11 * 60 + 40,
        metrics: { totalDistance: 80, hsr: 10 },
      }),
      drillRow({
        player: "B",
        drill: "Warm up",
        durationSeconds: 11 * 60 + 40,
        metrics: { totalDistance: 120, hsr: null },
      }),
    ];
    const built = buildOccurrences(newer, rows);
    const model = buildDrillAnalysisModel({
      session: newer,
      occurrences: built.occurrences,
      savedCards: [],
      player: null,
      excludedBlankDrillRows: 0,
      excludedBlankPlayerRows: 0,
    });
    const detail = historyDetailFromModel(model, model.cards[0].id);
    expect(detail?.title).toBe("Warm up");
    expect(detail?.sets).toEqual([{ label: "Warm up", duration: "12 min" }]);
    const td = detail?.metrics.find((metric) => metric.key === "totalDistance");
    const hsr = detail?.metrics.find((metric) => metric.key === "hsr");
    const acc = detail?.metrics.find((metric) => metric.key === "accelerations");
    expect(td?.values).toEqual([
      formatDrillMetric(model.cards[0].columns[0].metrics.totalDistance, "m"),
    ]);
    expect(td?.values).toEqual(["100 m"]);
    expect(hsr?.values).toEqual(["10 m"]);
    expect(acc?.values).toEqual(["—"]);
    expect(detail?.metrics.map((metric) => metric.label)).toEqual([
      "Total Distance",
      "Tempo Distance",
      "High Speed Running",
      "Sprint Distance",
      "Distance per minute",
      "Accelerations",
      "Decelerations",
    ]);
  });

  it("keeps the saved set order", () => {
    const rows = [
      drillRow({ player: "A", drill: "10v10 - SET1", start: "13:00:00", metrics: { totalDistance: 10 } }),
      drillRow({ player: "A", drill: "10v10 - SET2", start: "13:16:00", metrics: { totalDistance: 20 } }),
    ];
    const built = buildOccurrences(newer, rows);
    const set1 = built.occurrences.find((item) => item.drill.endsWith("SET1"));
    const set2 = built.occurrences.find((item) => item.drill.endsWith("SET2"));
    const model = buildDrillAnalysisModel({
      session: newer,
      occurrences: built.occurrences,
      savedCards: [
        {
          id: "55555555-5555-5555-5555-555555555555",
          displayName: "",
          sortIndex: 0,
          imagePath: null,
          occurrenceKeys: [set2!.key, set1!.key],
        },
      ],
      player: null,
      excludedBlankDrillRows: 0,
      excludedBlankPlayerRows: 0,
    });
    const detail = historyDetailFromModel(model, "55555555-5555-5555-5555-555555555555");
    expect(detail?.sets).toEqual([
      { label: "10v10 - SET2", duration: null },
      { label: "10v10 - SET1", duration: null },
    ]);
    expect(detail?.metrics.find((metric) => metric.key === "totalDistance")?.values).toEqual(["20 m", "10 m"]);
  });
});

function entry(title: string): HistoryEntry {
  return {
    id: title,
    sessionKey: "session",
    date: "2026-11-05",
    sessionLabel: "W17 · MD-3 · Team",
    title,
    setCount: 1,
    duration: null,
    hasImage: false,
    searchText: title.toLowerCase(),
  };
}
