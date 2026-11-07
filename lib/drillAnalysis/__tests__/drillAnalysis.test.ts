import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDrillAnalysisModel } from "@/lib/drillAnalysis/assemble";
import {
  modalDurationMinutes,
  formatDrillMetric,
  formatDurationMinutes,
  reportHeadings,
  roundDurationToMinutes,
  roundPowerBi0,
} from "@/lib/drillAnalysis/format";
import { detectDrillImage } from "@/lib/drillAnalysis/images";
import { buildOccurrenceKey, buildSessionKey, occurrenceMatchesSession } from "@/lib/drillAnalysis/keys";
import { buildOccurrences, emptyMetrics, metricsForPlayer } from "@/lib/drillAnalysis/metrics";
import { keptDrillAnalysisRequest } from "@/lib/drillAnalysis/pageSelection";
import { canAccessDrillAnalysis, DRILL_ANALYSIS_NAV_ITEM } from "@/lib/drillAnalysis/nav";
import { buildDrillSessionRowsDax } from "@/lib/drillAnalysis/query";
import type { DrillMetrics, ParsedDrillRow, SessionRef } from "@/lib/drillAnalysis/types";
import { layoutForDrillImage, validateLayoutSave } from "@/lib/drillAnalysis/validateLayout";

const session: SessionRef = {
  date: "2026-10-21",
  weekId: "W15",
  mdTag: "MD-5",
  sessionType: "Team",
};

const otherSession: SessionRef = {
  date: "2026-10-22",
  weekId: "W15",
  mdTag: "MD-4",
  sessionType: "Team",
};

function metrics(partial: Partial<DrillMetrics> = {}): DrillMetrics {
  return { ...emptyMetrics(), ...partial };
}

function drillRow(input: {
  player: string;
  drill: string;
  start?: string;
  sourceRows?: number;
  durationSeconds?: number | null;
  metrics?: Partial<DrillMetrics>;
}): ParsedDrillRow {
  const start = input.start ?? "10:00:00";
  return {
    player: input.player,
    drill: input.drill,
    startToken: start,
    startLabel: start,
    startParsed: start !== "blank",
    durationSeconds: input.durationSeconds ?? null,
    sourceRows: input.sourceRows ?? 1,
    metrics: metrics(input.metrics),
  };
}

describe("drill analysis access", () => {
  it("keeps the requested date when the session list cannot be loaded", () => {
    const kept = keptDrillAnalysisRequest({ date: "2026-11-05", player: "Ada" });
    expect(kept.selectedDate).toBe("2026-11-05");
    expect(kept.dates).toEqual(["2026-11-05"]);
    expect(kept.selectedPlayer).toBe("Ada");
    expect(kept.sessions).toEqual([]);
  });

  it("is available to admin and staff only", () => {
    expect(DRILL_ANALYSIS_NAV_ITEM.href).toBe("/drill-analysis");
    expect(canAccessDrillAnalysis("admin")).toBe(true);
    expect(canAccessDrillAnalysis("staff")).toBe(true);
    expect(canAccessDrillAnalysis("player")).toBe(false);
  });

  it("appends the nav item without removing existing entries", async () => {
    const sidebar = await readFile(path.join(process.cwd(), "components/Sidebar.tsx"), "utf8");
    const kiosk = sidebar.indexOf('href: "/kiosk-rpe"');
    const drill = sidebar.indexOf("DRILL_ANALYSIS_NAV_ITEM.href");
    expect(kiosk).toBeGreaterThan(0);
    expect(drill).toBeGreaterThan(kiosk);
    expect(sidebar).toContain('href: "/wellness"');
    expect(sidebar).toContain('href: "/rpe"');
    expect(sidebar).toContain("PLANNER_NAV_ITEM.href");
  });
});

describe("Power BI drill query", () => {
  it("reads raw metric columns and does not aggregate in DAX", () => {
    const dax = buildDrillSessionRowsDax(session);
    expect(dax).toContain('GPS_Log[Date] = DATE(2026,10,21)');
    expect(dax).toContain('GPS_Log[Week ID] = "W15"');
    expect(dax).toContain('GPS_Log[MD_Tag] = "MD-5"');
    expect(dax).toContain('GPS_Log[SessionType] = "Team"');
    expect(dax).toContain('"TD", GPS_Log[TD]');
    expect(dax).toContain('"Z4", GPS_Log[Z4]');
    expect(dax).toContain('"Z5", GPS_Log[Z5]');
    expect(dax).toContain('"Z6", GPS_Log[Z6]');
    expect(dax).toContain('"DistancePerMin", GPS_Log[Distance Per Min]');
    expect(dax).toContain('"DrillStart", GPS_Log[Drill Start Time]');
    expect(dax).toContain('"Duration", GPS_Log[Duration]');
    expect(dax).not.toContain("SUM(");
    expect(dax).not.toContain("AVERAGE(");
  });
});

describe("rounding locked to verified display measures", () => {
  it("rounds the team average once, including the 2026-10-21 checks", () => {
    expect(roundPowerBi0(280.6865)).toBe(281);
    expect(roundPowerBi0(32.58)).toBe(33);
    expect(roundPowerBi0(3.86)).toBe(4);
    expect(roundPowerBi0(3.7)).toBe(4);
    expect(roundPowerBi0(3.85)).toBe(4);
    expect(roundPowerBi0(112.5755)).toBe(113);
    expect(roundPowerBi0(17.403)).toBe(17);
    expect(roundPowerBi0(56.934)).toBe(57);
    expect(roundPowerBi0(0)).toBe(0);
    expect(formatDrillMetric(0, "m")).toBe("0 m");
    expect(formatDrillMetric(null, "m")).toBe("—");
  });
});

describe("occurrence identity", () => {
  it("does not group SET1, SET2 and SET3 from the name suffix", () => {
    const rows = ["SET1", "SET2", "SET3"].flatMap((set) =>
      ["A", "B"].map((player) =>
        drillRow({
          player,
          drill: `6v6 - Tactical - 30x40m - ${set}`,
          start: "12:00:00",
          metrics: { totalDistance: 300 },
        })
      )
    );
    const built = buildOccurrences(session, rows);
    expect(built.occurrences).toHaveLength(3);
    const view = buildDrillAnalysisModel({
      session,
      occurrences: built.occurrences,
      savedCards: [],
      player: null,
      excludedBlankDrillRows: 0,
      excludedBlankPlayerRows: 0,
    });
    expect(view.cards).toHaveLength(3);
    expect(view.cards.every((card) => card.columns.length === 1)).toBe(true);
  });

  it("shows three manually assigned occurrences as one card with one image and three columns", () => {
    const names = ["6v6 - Tactical - 30x40m - SET1", "6v6 - Tactical - 30x40m - SET2", "6v6 - Tactical - 30x40m - SET3"];
    const rows = names.flatMap((drill, index) =>
      ["A", "B"].map((player) =>
        drillRow({
          player,
          drill,
          start: `12:0${index}:00`,
          metrics: { totalDistance: 300 + index, distancePerMin: 100 + index },
        })
      )
    );
    const built = buildOccurrences(session, rows);
    const view = buildDrillAnalysisModel({
      session,
      occurrences: built.occurrences,
      savedCards: [
        {
          id: "card-1",
          displayName: "6v6 - Tactical - 30x40m",
          sortIndex: 0,
          imagePath: "cards/11111111-1111-1111-1111-111111111111/drawing.png",
          occurrenceKeys: built.occurrences.map((occurrence) => occurrence.key),
        },
      ],
      player: null,
      excludedBlankDrillRows: 0,
      excludedBlankPlayerRows: 0,
    });
    expect(view.cards).toHaveLength(1);
    expect(view.cards[0]?.columns.map((column) => column.label)).toEqual(names);
    const playerView = buildDrillAnalysisModel({
      session,
      occurrences: built.occurrences,
      savedCards: [
        {
          id: "card-1",
          displayName: "6v6 - Tactical - 30x40m",
          sortIndex: 0,
          imagePath: "cards/11111111-1111-1111-1111-111111111111/drawing.png",
          occurrenceKeys: built.occurrences.map((occurrence) => occurrence.key),
        },
      ],
      player: "A",
      excludedBlankDrillRows: 0,
      excludedBlankPlayerRows: 0,
    });
    expect(playerView.cards[0]?.columns.map((column) => column.occurrenceKey)).toEqual(
      view.cards[0]?.columns.map((column) => column.occurrenceKey)
    );
    expect(playerView.cards[0]?.columns.map((column) => column.label)).toEqual(names);
    expect(view.cards[0]?.hasImage).toBe(true);
    expect(view.cards[0]?.columns.map((column) => column.metrics.totalDistance)).toEqual([300, 301, 302]);
    expect(view.cards[0]?.columns.map((column) => column.metrics.distancePerMin)).toEqual([100, 101, 102]);
    const summed = (view.cards[0]?.columns ?? []).reduce((sum, column) => sum + (column.metrics.distancePerMin ?? 0), 0);
    expect(summed).not.toBe(view.cards[0]?.columns[0]?.metrics.distancePerMin);
  });

  it("keeps same-name repeats apart when players performed the drill twice", () => {
    const rows = ["11:00:00", "11:20:00"].flatMap((start) =>
      ["A", "B"].map((player) =>
        drillRow({ player, drill: "3v3 - 30x20m", start, metrics: { totalDistance: start === "11:00:00" ? 100 : 180 } })
      )
    );
    const built = buildOccurrences(session, rows);
    expect(built.occurrences).toHaveLength(2);
    expect(new Set(built.occurrences.map((occurrence) => occurrence.key)).size).toBe(2);
    expect(built.occurrences.map((occurrence) => metricsForPlayer(occurrence, null).totalDistance)).toEqual([100, 180]);
  });

  it("keeps one cohort when only a stray start time differs", () => {
    const rows = [
      drillRow({ player: "A", drill: "Warm up", start: "10:00:00", metrics: { totalDistance: 100 } }),
      drillRow({ player: "B", drill: "Warm up", start: "10:00:00", metrics: { totalDistance: 140 } }),
      drillRow({ player: "C", drill: "Warm up", start: "10:04:00", metrics: { totalDistance: 120 } }),
    ];
    const built = buildOccurrences(session, rows);
    expect(built.occurrences).toHaveLength(1);
    expect(built.occurrences[0]?.identity).toBe("cohort");
    expect(built.occurrences[0]?.timeUncertain).toBe(true);
    expect(metricsForPlayer(built.occurrences[0]!, null).totalDistance).toBe(120);
  });

  it("does not mix dates or sessions", () => {
    const drill = "Rondo";
    const left = buildOccurrenceKey(session, drill, "cohort");
    const right = buildOccurrenceKey(otherSession, drill, "cohort");
    expect(left).not.toBe(right);
    expect(occurrenceMatchesSession(right, buildSessionKey(session))).toBe(false);
    expect(occurrenceMatchesSession(left, buildSessionKey(session))).toBe(true);
  });

  it("does not sum identical duplicate player rows or conflicting ones", () => {
    const identical = buildOccurrences(session, [
      drillRow({ player: "A", drill: "Rondo", metrics: { totalDistance: 10, sprintDistance: 0 } }),
      drillRow({ player: "A", drill: "Rondo", metrics: { totalDistance: 10, sprintDistance: 0 } }),
    ]);
    expect(identical.occurrences[0]?.playerCount).toBe(1);
    expect(identical.occurrences[0]?.sourceRowCount).toBe(2);
    expect(metricsForPlayer(identical.occurrences[0]!, null).totalDistance).toBe(10);
    expect(metricsForPlayer(identical.occurrences[0]!, null).sprintDistance).toBe(0);

    const conflict = buildOccurrences(session, [
      drillRow({ player: "A", drill: "Rondo", metrics: { totalDistance: 10 } }),
      drillRow({ player: "A", drill: "Rondo", metrics: { totalDistance: 30 } }),
    ]);
    expect(conflict.occurrences[0]?.hasPlayerConflict).toBe(true);
    expect(metricsForPlayer(conflict.occurrences[0]!, "A").totalDistance).toBeNull();
  });

  it("covers every named source row once and reports blank names", () => {
    const rows = [
      drillRow({ player: "A", drill: "Rondo", metrics: { totalDistance: 10 } }),
      drillRow({ player: "B", drill: "Rondo", metrics: { totalDistance: 20 } }),
      drillRow({ player: "A", drill: "", metrics: { totalDistance: 99 } }),
      drillRow({ player: "", drill: "SAQ", metrics: { totalDistance: 5 } }),
    ];
    const built = buildOccurrences(session, rows);
    const covered = built.occurrences.reduce((sum, occurrence) => sum + occurrence.sourceRowCount, 0);
    expect(covered + built.excludedBlankDrillRows + built.excludedBlankPlayerRows).toBe(rows.length);
    expect(built.excludedBlankDrillRows).toBe(1);
    expect(built.occurrences.map((occurrence) => occurrence.drill)).toEqual(["Rondo"]);
  });
});

describe("player filter and full training", () => {
  it("does not replace a missing player with the team average", () => {
    const built = buildOccurrences(session, [
      drillRow({ player: "A", drill: "Rondo", metrics: { totalDistance: 100, distancePerMin: 50 } }),
      drillRow({ player: "B", drill: "Rondo", metrics: { totalDistance: 300, distancePerMin: 70 } }),
    ]);
    const occurrence = built.occurrences[0]!;
    expect(metricsForPlayer(occurrence, null).totalDistance).toBe(200);
    expect(metricsForPlayer(occurrence, "A").totalDistance).toBe(100);
    expect(metricsForPlayer(occurrence, "Missing").totalDistance).toBeNull();
    expect(metricsForPlayer(occurrence, "Missing").distancePerMin).toBeNull();
  });

  it("keeps Full Training out of the drill cards and does not sum the cards into it", () => {
    const rows = [
      drillRow({ player: "A", drill: "Full Training", metrics: { totalDistance: 4000, distancePerMin: 55 } }),
      drillRow({ player: "A", drill: "Rondo", metrics: { totalDistance: 100, distancePerMin: 40 } }),
      drillRow({ player: "A", drill: "SAQ", metrics: { totalDistance: 80, distancePerMin: 30 } }),
    ];
    const built = buildOccurrences(session, rows);
    const view = buildDrillAnalysisModel({
      session,
      occurrences: built.occurrences,
      savedCards: [],
      player: "A",
      excludedBlankDrillRows: 0,
      excludedBlankPlayerRows: 0,
    });
    expect(view.cards.map((card) => card.displayName).sort()).toEqual(["Rondo", "SAQ"]);
    expect(view.fullTraining.status).toBe("ready");
    expect(view.fullTraining.columns[0]?.metrics.totalDistance).toBe(4000);
    expect(view.fullTraining.columns[0]?.metrics.distancePerMin).toBe(55);
  });
});

describe("layout validation", () => {
  const built = buildOccurrences(session, [
    drillRow({ player: "A", drill: "6v6 - 30x40m - SET1" }),
    drillRow({ player: "A", drill: "6v6 - 30x40m - SET2" }),
    drillRow({ player: "A", drill: "Full Training", metrics: { totalDistance: 1000 } }),
  ]);

  it("rejects a duplicate assignment and a cross-session assignment", () => {
    const [first, second] = built.occurrences.filter((occurrence) => occurrence.drill !== "Full Training");
    const duplicate = validateLayoutSave({
      sessionKey: buildSessionKey(session),
      occurrences: built.occurrences,
      previousCards: [],
      cards: [
        { displayName: "One", occurrenceKeys: [first.key], previousCardId: null, keepImage: false },
        { displayName: "Two", occurrenceKeys: [first.key, second.key], previousCardId: null, keepImage: false },
      ],
    });
    expect(duplicate.ok).toBe(false);

    const foreign = buildOccurrenceKey(otherSession, "Rondo", "cohort");
    const cross = validateLayoutSave({
      sessionKey: buildSessionKey(session),
      occurrences: built.occurrences,
      previousCards: [],
      cards: [{ displayName: "Other", occurrenceKeys: [foreign], previousCardId: null, keepImage: false }],
    });
    expect(cross.ok).toBe(false);
  });

  it("returns occurrences to the ungrouped list when the card is removed", () => {
    const drills = built.occurrences.filter((occurrence) => occurrence.drill !== "Full Training");
    const saved = buildDrillAnalysisModel({
      session,
      occurrences: built.occurrences,
      savedCards: [
        {
          id: "card-1",
          displayName: "6v6",
          sortIndex: 0,
          imagePath: null,
          occurrenceKeys: drills.map((occurrence) => occurrence.key),
        },
      ],
      player: null,
      excludedBlankDrillRows: 0,
      excludedBlankPlayerRows: 0,
    });
    expect(saved.cards).toHaveLength(1);
    const cleared = buildDrillAnalysisModel({
      session,
      occurrences: built.occurrences,
      savedCards: [],
      player: null,
      excludedBlankDrillRows: 0,
      excludedBlankPlayerRows: 0,
    });
    expect(cleared.cards.map((card) => card.displayName).sort()).toEqual(["6v6 - 30x40m - SET1", "6v6 - 30x40m - SET2"]);
    expect(cleared.fullTraining.status).toBe("ready");
  });

  it("keeps a missing saved occurrence visible and does not rebind it by name", () => {
    const stale = buildOccurrenceKey(session, "Old drill", "cohort");
    const view = buildDrillAnalysisModel({
      session,
      occurrences: built.occurrences,
      savedCards: [
        {
          id: "card-1",
          displayName: "Old drill",
          sortIndex: 0,
          imagePath: null,
          occurrenceKeys: [stale],
        },
      ],
      player: "A",
      excludedBlankDrillRows: 0,
      excludedBlankPlayerRows: 0,
    });
    const staleCard = view.cards.find((card) => card.id === "card-1");
    expect(staleCard?.missingCount).toBe(1);
    expect(staleCard?.columns[0]?.metrics.totalDistance).toBeNull();
    expect(view.cards.at(-1)?.id).toBe("card-1");
    expect(view.cards.filter((card) => card.displayName === "6v6 - 30x40m - SET1")).toHaveLength(1);
  });

  it("keeps a variable number of original columns, an empty name, and the existing card id", () => {
    const names = ["Set A", "Set B", "Set C", "Set D", "Set E", "Set F"];
    const rows = names.flatMap((drill, index) => [
      drillRow({ player: "A", drill, metrics: { totalDistance: 10 + index, distancePerMin: 20 + index } }),
      drillRow({ player: "B", drill, metrics: { totalDistance: 30 + index, distancePerMin: 40 + index } }),
    ]);
    const built = buildOccurrences(session, rows);
    const keys = built.occurrences.map((occurrence) => occurrence.key);
    const cardId = "11111111-1111-4111-8111-111111111111";
    const imagePath = "cards/11111111-1111-4111-8111-111111111111/drawing.png";
    const saved = validateLayoutSave({
      sessionKey: buildSessionKey(session),
      occurrences: built.occurrences,
      previousCards: [
        { id: cardId, displayName: "", sortIndex: 0, imagePath, occurrenceKeys: keys.slice(0, 2) },
      ],
      cards: [{ displayName: "   ", occurrenceKeys: keys, previousCardId: cardId, keepImage: true }],
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.cards[0]?.id).toBe(cardId);
    expect(saved.cards[0]?.displayName).toBe("");
    expect(saved.cards[0]?.imagePath).toBe(imagePath);
    expect(saved.cards[0]?.occurrenceKeys).toEqual(keys);

    const view = buildDrillAnalysisModel({
      session,
      occurrences: built.occurrences,
      savedCards: [
        {
          id: cardId,
          displayName: saved.cards[0]!.displayName,
          sortIndex: 0,
          imagePath,
          occurrenceKeys: saved.cards[0]!.occurrenceKeys,
        },
      ],
      player: "A",
      excludedBlankDrillRows: 0,
      excludedBlankPlayerRows: 0,
    });
    expect(view.cards).toHaveLength(1);
    expect(view.cards[0]?.id).toBe(cardId);
    expect(view.cards[0]?.hasImage).toBe(true);
    expect(view.cards[0]?.columns.map((column) => column.label)).toEqual(names);
    expect(view.cards[0]?.columns.map((column) => column.metrics.totalDistance)).toEqual([10, 11, 12, 13, 14, 15]);
    expect(view.cards[0]?.columns.map((column) => column.metrics.distancePerMin)).toEqual([20, 21, 22, 23, 24, 25]);
  });
});

describe("original session order", () => {
  it("places a grouped card at its earliest source drill, for every player", () => {
    const sequence = [
      ["10:00:00", "SAQ"],
      ["10:10:00", "Rondo - 4v2 - Two Sided"],
      ["10:20:00", "3v3  - finishing - 25x20m - SET1"],
      ["10:30:00", "3v3 - finishing - 25x20m - SET2"],
      ["10:40:00", "6v6 - 30x40m - SET1"],
      ["10:50:00", "6v6 - 30x40m - SET2"],
      ["11:00:00", "6v6 - 30x40m - SET3"],
      ["11:10:00", "6v6 - 30x40m - SET4"],
    ] as const;
    const rows = sequence.flatMap(([start, drill]) =>
      ["A", "B"].map((player) => drillRow({ player, drill, start, metrics: { totalDistance: 100 } }))
    );
    const built = buildOccurrences(session, rows);
    const keyFor = (drill: string) => built.occurrences.find((occurrence) => occurrence.drill === drill)!.key;
    const finishing = [
      keyFor("3v3  - finishing - 25x20m - SET1"),
      keyFor("3v3 - finishing - 25x20m - SET2"),
    ];
    const six = ["SET1", "SET2", "SET3", "SET4"].map((set) => keyFor(`6v6 - 30x40m - ${set}`));
    const savedCards = [
      {
        id: "66666666-6666-4666-8666-666666666666",
        displayName: "6v6",
        sortIndex: 0,
        imagePath: null,
        occurrenceKeys: six,
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        displayName: "3v3 finishing",
        sortIndex: 1,
        imagePath: null,
        occurrenceKeys: finishing,
      },
    ];
    const input = {
      session,
      occurrences: built.occurrences,
      savedCards,
      excludedBlankDrillRows: 0,
      excludedBlankPlayerRows: 0,
    };
    const team = buildDrillAnalysisModel({ ...input, player: null });
    const player = buildDrillAnalysisModel({ ...input, player: "A" });
    expect(team.cards.map((card) => card.displayName)).toEqual([
      "SAQ",
      "Rondo - 4v2 - Two Sided",
      "3v3 finishing",
      "6v6",
    ]);
    expect(player.cards.map((card) => card.id)).toEqual(team.cards.map((card) => card.id));
    expect(team.cards[2]?.columns.map((column) => column.label)).toEqual([
      "3v3  - finishing - 25x20m - SET1",
      "3v3 - finishing - 25x20m - SET2",
    ]);
    expect(team.cards[3]?.columns).toHaveLength(4);
    expect(team.editorCards.map((card) => card.displayName)).toEqual(["3v3 finishing", "6v6"]);
  });

  it("orders a drill by its earliest clock when player start times differ", () => {
    const rows = [
      drillRow({ player: "A", drill: "Warm up", start: "12:13:46", metrics: { totalDistance: 1 } }),
      drillRow({ player: "B", drill: "Warm up", start: "12:23:33", metrics: { totalDistance: 1 } }),
      drillRow({ player: "A", drill: "Recovery Sprint", start: "12:26:29", metrics: { totalDistance: 1 } }),
      drillRow({ player: "B", drill: "Recovery Sprint", start: "12:26:29", metrics: { totalDistance: 1 } }),
      drillRow({ player: "A", drill: "10v10", start: "13:00:00", metrics: { totalDistance: 1 } }),
      drillRow({ player: "B", drill: "10v10", start: "13:00:00", metrics: { totalDistance: 1 } }),
    ];
    const built = buildOccurrences(session, rows);
    const view = buildDrillAnalysisModel({
      session,
      occurrences: built.occurrences,
      savedCards: [],
      player: null,
      excludedBlankDrillRows: 0,
      excludedBlankPlayerRows: 0,
    });
    expect(view.cards.map((card) => card.displayName)).toEqual(["Warm up", "Recovery Sprint", "10v10"]);
  });
});

describe("drill duration", () => {
  it("rounds 30 seconds up and anything under 30 down", () => {
    expect(roundDurationToMinutes(10 * 60 + 32)).toBe(11);
    expect(roundDurationToMinutes(10 * 60 + 30)).toBe(11);
    expect(roundDurationToMinutes(10 * 60 + 29)).toBe(10);
    expect(roundDurationToMinutes(20 * 60)).toBe(20);
    expect(roundDurationToMinutes(86 * 60)).toBe(86);
    expect(formatDurationMinutes(11)).toBe("11 min");
    expect(formatDurationMinutes(null)).toBe("—");
  });

  it("writes the minute most players recorded and ignores a short outlier", () => {
    const rows = [
      drillRow({ player: "A", drill: "Warm up", durationSeconds: 11 * 60 + 40, metrics: { totalDistance: 1 } }),
      drillRow({ player: "B", drill: "Warm up", durationSeconds: 11 * 60 + 40, metrics: { totalDistance: 1 } }),
      drillRow({ player: "C", drill: "Warm up", durationSeconds: 1 * 60 + 7, metrics: { totalDistance: 1 } }),
      drillRow({ player: "A", drill: "10v10", durationSeconds: 19 * 60 + 35, metrics: { totalDistance: 1 } }),
      drillRow({ player: "B", drill: "10v10", durationSeconds: 19 * 60 + 35, metrics: { totalDistance: 1 } }),
      drillRow({ player: "A", drill: "Full Training", durationSeconds: 86 * 60, metrics: { totalDistance: 1 } }),
      drillRow({ player: "B", drill: "Full Training", durationSeconds: 58 * 60 + 7, metrics: { totalDistance: 1 } }),
    ];
    const built = buildOccurrences(session, rows);
    const team = buildDrillAnalysisModel({
      session,
      occurrences: built.occurrences,
      savedCards: [],
      player: null,
      excludedBlankDrillRows: 0,
      excludedBlankPlayerRows: 0,
    });
    const player = buildDrillAnalysisModel({
      session,
      occurrences: built.occurrences,
      savedCards: [],
      player: "C",
      excludedBlankDrillRows: 0,
      excludedBlankPlayerRows: 0,
    });
    expect(team.cards.find((card) => card.displayName === "Warm up")?.columns[0]?.durationMinutes).toBe(12);
    expect(team.cards.find((card) => card.displayName === "10v10")?.columns[0]?.durationMinutes).toBe(20);
    expect(team.fullTraining.columns[0]?.durationMinutes).toBe(86);
    expect(player.cards.find((card) => card.displayName === "Warm up")?.columns[0]?.durationMinutes).toBe(1);
    expect(modalDurationMinutes([null, null])).toBeNull();
  });
});

describe("drill image layout", () => {
  it("adds one card for an unsaved drill and keeps an existing image", () => {
    const savedKey = buildOccurrenceKey(session, "6v6", "cohort");
    const warmUpKey = buildOccurrenceKey(session, "Warm up", "cohort");
    const imagePath = "cards/11111111-1111-4111-8111-111111111111/drawing.png";
    const previous = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        displayName: "6v6",
        sortIndex: 0,
        imagePath,
        occurrenceKeys: [savedKey],
      },
    ];
    const created = layoutForDrillImage(previous, warmUpKey);
    expect(created).toEqual({
      cards: [
        {
          displayName: "6v6",
          occurrenceKeys: [savedKey],
          previousCardId: "11111111-1111-4111-8111-111111111111",
          keepImage: true,
        },
        {
          displayName: "",
          occurrenceKeys: [warmUpKey],
          previousCardId: null,
          keepImage: false,
        },
      ],
    });
    expect("cardId" in layoutForDrillImage([...previous, {
      id: "22222222-2222-4222-8222-222222222222",
      displayName: "",
      sortIndex: 1,
      imagePath: null,
      occurrenceKeys: [warmUpKey],
    }], warmUpKey)).toBe(true);

    const rows = [
      drillRow({ player: "A", drill: "6v6", metrics: { totalDistance: 1 } }),
      drillRow({ player: "A", drill: "Warm up", metrics: { totalDistance: 1 } }),
    ];
    const built = buildOccurrences(session, rows);
    if (!("cards" in created)) return;
    const validated = validateLayoutSave({
      sessionKey: buildSessionKey(session),
      occurrences: built.occurrences,
      previousCards: previous,
      cards: created.cards,
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.cards[0]?.imagePath).toBe(imagePath);
    expect(validated.cards[1]?.occurrenceKeys).toEqual([warmUpKey]);
  });
});

describe("report headings", () => {
  it("shows one shared name and SET labels without changing different source names", () => {
    const six = ["SET1", "SET2", "SET3", "SET4"].map((set) => `6v6 - 30x40m - ${set}`);
    const grouped = reportHeadings("", six);
    expect(grouped.title).toBe("6v6 - 30x40m");
    expect(grouped.setCountLabel).toBe("4 sets");
    expect(grouped.columnLabels).toEqual(["SET1", "SET2", "SET3", "SET4"]);
    expect(six).toEqual(["SET1", "SET2", "SET3", "SET4"].map((set) => `6v6 - 30x40m - ${set}`));

    const named = reportHeadings("6v6", six);
    expect(named.title).toBe("6v6");
    expect(named.columnLabels).toEqual(["SET1", "SET2", "SET3", "SET4"]);

    const spaced = reportHeadings("", [
      "3v3  - finishing - 25x20m - SET1",
      "3v3 - finishing - 25x20m - SET2",
    ]);
    expect(spaced.title).toBe("3v3 - finishing - 25x20m");
    expect(spaced.columnLabels).toEqual(["SET1", "SET2"]);

    const different = reportHeadings("", [
      "3v3 - finishing - 25x20m - SET1",
      "6v6 - 30x40m - SET1",
    ]);
    expect(different.title).toBe("");
    expect(different.columnLabels).toEqual([
      "3v3 - finishing - 25x20m - SET1",
      "6v6 - 30x40m - SET1",
    ]);
    expect(reportHeadings("", ["SAQ"]).title).toBe("SAQ");
    expect(reportHeadings("", ["SAQ"]).columnLabels).toEqual([""]);
  });
});

describe("image detection", () => {
  it("accepts jpeg, png and webp bytes and rejects other files", () => {
    expect(detectDrillImage(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))?.ext).toBe("jpg");
    expect(
      detectDrillImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext
    ).toBe("png");
    const webp = new Uint8Array(12);
    webp.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(detectDrillImage(webp)?.ext).toBe("webp");
    expect(detectDrillImage(Uint8Array.from([0x47, 0x49, 0x46, 0x38]))).toBeNull();
  });
});
