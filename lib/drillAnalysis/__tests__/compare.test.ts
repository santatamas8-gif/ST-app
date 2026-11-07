import { describe, expect, it } from "vitest";
import { buildDrillAnalysisModel } from "@/lib/drillAnalysis/assemble";
import { compareOccurrence } from "@/lib/drillAnalysis/compare";
import { formatMetricDifference } from "@/lib/drillAnalysis/format";
import { buildOccurrences, emptyMetrics } from "@/lib/drillAnalysis/metrics";
import type { DrillMetrics, ParsedDrillRow, SavedDrillCard, SessionRef } from "@/lib/drillAnalysis/types";

const session: SessionRef = { date: "2026-11-06", weekId: "W17", mdTag: "MD-2", sessionType: "Team" };

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

function modelFor(rows: ParsedDrillRow[], player: string | null, savedCards: SavedDrillCard[] = []) {
  const built = buildOccurrences(session, rows);
  return buildDrillAnalysisModel({
    session,
    occurrences: built.occurrences,
    savedCards,
    player,
    excludedBlankDrillRows: 0,
    excludedBlankPlayerRows: 0,
  });
}

describe("player comparison", () => {
  it("matches each player's own sheet and does not treat a missing value as zero", () => {
    const rows = [
      drillRow({ player: "Ada", drill: "Warm up", durationSeconds: 11 * 60 + 40, metrics: { totalDistance: 200, hsr: 0, accelerations: 4 } }),
      drillRow({ player: "Ben", drill: "Warm up", durationSeconds: 19 * 60 + 10, metrics: { totalDistance: 80, hsr: null, accelerations: 4 } }),
    ];
    const team = modelFor(rows, null);
    const ada = modelFor(rows, "Ada");
    const ben = modelFor(rows, "Ben");
    const key = team.cards[0]!.columns[0]!.occurrenceKey;
    expect(team.playerValues[key]?.Ada.metrics).toEqual(ada.cards[0]?.columns[0]?.metrics);
    expect(team.playerValues[key]?.Ben.metrics).toEqual(ben.cards[0]?.columns[0]?.metrics);
    expect(team.cards[0]?.columns[0]?.metrics.totalDistance).not.toBe(ada.cards[0]?.columns[0]?.metrics.totalDistance);

    const compared = compareOccurrence(team.playerValues[key], "Ada", "Ben");
    expect(compared.rows.find((row) => row.key === "totalDistance")).toEqual({
      key: "totalDistance",
      label: "Total Distance",
      playerA: "200 m",
      playerB: "80 m",
      difference: "+120 m",
    });
    expect(compared.rows.find((row) => row.key === "hsr")?.difference).toBe("—");
    expect(compared.rows.find((row) => row.key === "hsr")?.playerA).toBe("0 m");
    expect(compared.rows.find((row) => row.key === "accelerations")?.difference).toBe("0");
    expect(compared.durationA).toBe("12 min");
    expect(compared.durationB).toBe("19 min");
    expect(team.cards[0]?.columns[0]?.durationMinutes).toBe(19);
    const rounded = modelFor(
      [
        drillRow({ player: "Ada", drill: "Warm up", metrics: { sprintDistance: 10.6 } }),
        drillRow({ player: "Ben", drill: "Warm up", metrics: { sprintDistance: 10.4 } }),
      ],
      null
    );
    const roundedKey = rounded.cards[0]!.columns[0]!.occurrenceKey;
    expect(compareOccurrence(rounded.playerValues[roundedKey], "Ada", "Ben").rows.find((row) => row.key === "sprintDistance")?.difference).toBe("+1 m");
  });

  it("signs the rounded difference and leaves a gap when either side is missing", () => {
    expect(formatMetricDifference(200, 80, "m")).toBe("+120 m");
    expect(formatMetricDifference(80, 200, "m")).toBe("−120 m");
    expect(formatMetricDifference(3, 3, "count")).toBe("0");
    expect(formatMetricDifference(0, null, "m")).toBe("—");
    expect(formatMetricDifference(null, 0, "count")).toBe("—");
  });

  it("pairs each set by its own occurrence and keeps a player who missed one set", () => {
    const rows = [
      drillRow({ player: "Ada", drill: "10v10 - SET1", start: "13:00:00", metrics: { totalDistance: 100 } }),
      drillRow({ player: "Ben", drill: "10v10 - SET1", start: "13:00:00", metrics: { totalDistance: 80 } }),
      drillRow({ player: "Ben", drill: "10v10 - SET2", start: "13:16:00", metrics: { totalDistance: 40 } }),
    ];
    const view = modelFor(rows, null, [
      {
        id: "card-1",
        displayName: "10v10",
        sortIndex: 0,
        imagePath: "cards/card-1/pitch.png",
        occurrenceKeys: viewKeys(rows),
      },
    ]);
    const card = view.cards[0]!;
    expect(card.columns.map((column) => column.label)).toEqual(["10v10 - SET1", "10v10 - SET2"]);
    expect(card.hasImage).toBe(true);
    const first = compareOccurrence(view.playerValues[card.columns[0]!.occurrenceKey], "Ada", "Ben");
    const second = compareOccurrence(view.playerValues[card.columns[1]!.occurrenceKey], "Ada", "Ben");
    expect(first.rows.find((row) => row.key === "totalDistance")).toMatchObject({
      playerA: "100 m",
      playerB: "80 m",
      difference: "+20 m",
    });
    expect(second.rows.find((row) => row.key === "totalDistance")).toMatchObject({
      playerA: "—",
      playerB: "40 m",
      difference: "—",
    });
    expect(second.durationA).toBe("—");
  });

  it("compares Full Training from its own row, not the sum of the drill cards", () => {
    const rows = [
      drillRow({ player: "Ada", drill: "Warm up", metrics: { totalDistance: 100 } }),
      drillRow({ player: "Ben", drill: "Warm up", metrics: { totalDistance: 80 } }),
      drillRow({ player: "Ada", drill: "Full Training", metrics: { totalDistance: 5000 } }),
      drillRow({ player: "Ben", drill: "Full Training", metrics: { totalDistance: 4700 } }),
    ];
    const view = modelFor(rows, "Ada");
    expect(view.fullTraining.columns).toHaveLength(1);
    expect(view.cards.some((card) => card.displayName === "Full Training")).toBe(false);
    const key = view.fullTraining.columns[0]!.occurrenceKey;
    const compared = compareOccurrence(view.playerValues[key], "Ada", "Ben");
    expect(compared.rows.find((row) => row.key === "totalDistance")).toMatchObject({
      playerA: "5000 m",
      playerB: "4700 m",
      difference: "+300 m",
    });
    expect(view.fullTraining.columns[0]?.metrics.totalDistance).toBe(5000);
  });
});

function viewKeys(rows: ParsedDrillRow[]): string[] {
  return buildOccurrences(session, rows).occurrences.filter((item) => item.drill !== "Full Training").map((item) => item.key);
}
