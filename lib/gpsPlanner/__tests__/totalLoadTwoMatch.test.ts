import { describe, expect, it } from "vitest";

import type { AbsoluteMetrics } from "@/lib/gpsPlanner/calculations";
import type {
  PlannerWeekOfficialMatch,
  PlannerWeeklyProgressResult,
} from "@/lib/gpsPlanner/types";
import {
  composeTotalLoadResult,
  type TotalLoadMatchSource,
} from "@/lib/gpsPlanner/totalLoadAggregation";
import type { MatchActualPlayerResult } from "@/lib/powerbi/queries/matchActualClassify";

const WEEK = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  powerbiWeekId: "W5",
  startDate: "2026-08-11",
  endDate: "2026-08-14",
};

const MATCH_1: PlannerWeekOfficialMatch = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  weekId: WEEK.id,
  gpsDate: "2026-08-15",
  matchOrder: 1,
  mdTag: "MD",
  opponent: "FK Csikszereda",
  matchday: "Matchday 5",
  competition: "Liga 1",
  createdBy: null,
  updatedBy: null,
  createdAt: "",
  updatedAt: "",
};

const MATCH_2: PlannerWeekOfficialMatch = {
  ...MATCH_1,
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  gpsDate: "2026-08-18",
  matchOrder: 2,
  opponent: "CFR Cluj",
  matchday: "Matchday 6",
};

const ZERO: AbsoluteMetrics = {
  totalDistance: 0,
  hsr: 0,
  sprint: 0,
  accelerations: 0,
  decelerations: 0,
};

function abs(
  td: number,
  hsr = 10,
  sprint = 5,
  acc = 2,
  dec = 3
): AbsoluteMetrics {
  return {
    totalDistance: td,
    hsr,
    sprint,
    accelerations: acc,
    decelerations: dec,
  };
}

function training(input: {
  playerId: string;
  name: string;
  pbi: string;
  completeness: PlannerWeeklyProgressResult["actualCompleteness"];
  actual: AbsoluteMetrics | null;
  frozenTd?: number;
}): PlannerWeeklyProgressResult {
  const frozenTd = input.frozenTd ?? 11000;
  return {
    weekId: WEEK.id,
    powerBiWeekId: WEEK.powerbiWeekId,
    playerId: input.playerId,
    playerDisplayName: input.name,
    throughDate: WEEK.endDate,
    frozen: {
      tdBest: frozenTd,
      hsrBest: 800,
      sprintBest: 200,
      accBest: 40,
      decBest: 40,
      powerBiPlayerName: input.pbi,
      sourceMethod: "single-match best",
    },
    weeklyPct: { tdPct: 80, hsrPct: 80, sprintPct: 80, accPct: 80, decPct: 80 },
    weeklyPlanned: abs(frozenTd * 0.8),
    dailyAllocationSum: {
      tdPct: 0,
      hsrPct: 0,
      sprintPct: 0,
      accPct: 0,
      decPct: 0,
    },
    remainingToAllocate: {
      tdPct: 80,
      hsrPct: 80,
      sprintPct: 80,
      accPct: 80,
      decPct: 80,
    },
    days: [],
    includedDays: 4,
    foundDays: input.completeness === "complete" ? 4 : 2,
    notFoundDays: input.completeness === "partial_not_found" ? 2 : 0,
    problematicDays: input.completeness === "incomplete" ? 1 : 0,
    weeklyActual: input.actual,
    weeklyToTarget: null,
    actualCompleteness: input.completeness,
  };
}

function matchOk(
  name: string,
  metrics: AbsoluteMetrics & { durationSeconds: number }
): MatchActualPlayerResult {
  return {
    playerName: name,
    quality: "match_ok",
    halves: { first: "valid", second: "valid" },
    metrics: { ...metrics },
  };
}

function matchZero(name: string): MatchActualPlayerResult {
  return {
    playerName: name,
    quality: "match_zero",
    halves: { first: "absent", second: "absent" },
    metrics: { ...ZERO, durationSeconds: 0 },
  };
}

function available(
  match: PlannerWeekOfficialMatch,
  byPlayerName: Map<string, MatchActualPlayerResult>
): TotalLoadMatchSource {
  return {
    officialMatch: match,
    availability: "available",
    matchBatch: { ok: true, byPlayerName },
  };
}

function pending(match: PlannerWeekOfficialMatch): TotalLoadMatchSource {
  return {
    officialMatch: match,
    availability: "pending",
    matchBatch: null,
  };
}

function compose(
  rows: PlannerWeeklyProgressResult[],
  officialMatches: PlannerWeekOfficialMatch[],
  matchSources: TotalLoadMatchSource[]
) {
  return composeTotalLoadResult({
    week: WEEK,
    officialMatches,
    trainingRows: rows,
    matchSources,
  });
}

describe("Phase E Total Load 0–2 Match composition", () => {
  it("A: 0 configured Matches → match_not_selected, no final Total", () => {
    const row = training({
      playerId: "p1",
      name: "Doru Andrei",
      pbi: "Doru Andrei",
      completeness: "complete",
      actual: abs(14000),
    });
    const result = compose([row], [], []);
    expect(result.officialMatch.selected).toBe(false);
    expect(result.officialMatches).toEqual([]);
    expect(result.rows[0].quality).toBe("match_not_selected");
    expect(result.rows[0].matches).toEqual([]);
    expect(result.rows[0].total.metrics).toBeNull();
    expect(result.rows[0].total.percentages).toBeNull();
    expect(result.topValues.totalDistance).toBeNull();
  });

  it("B: 1 safe Match remains V1-equivalent Training + Match 1", () => {
    const row = training({
      playerId: "p1",
      name: "Doru Andrei",
      pbi: "Doru Andrei",
      completeness: "complete",
      actual: abs(10500, 100, 20, 10, 11),
      frozenTd: 20000,
    });
    const result = compose(
      [row],
      [MATCH_1],
      [
        available(
          MATCH_1,
          new Map([
            [
              "Doru Andrei",
              matchOk("Doru Andrei", {
                ...abs(5000, 50, 10, 5, 6),
                durationSeconds: 5480,
              }),
            ],
          ])
        ),
      ]
    );
    const player = result.rows[0];
    expect(player.quality).toBe("complete");
    expect(player.matches).toHaveLength(1);
    expect(player.total.metrics).toEqual(abs(15500, 150, 30, 15, 17));
    expect(player.total.percentages?.totalDistance).toBe(77.5);
    expect(player.match.durationSeconds).toBe(5480);
    expect(player.match.metrics).toEqual(abs(5000, 50, 10, 5, 6));
  });

  it("C/K/L: 2 safe Matches sum Training + M1 + M2; Match Time sums; % uses frozen 1-Match Best", () => {
    const row = training({
      playerId: "p1",
      name: "Doru Andrei",
      pbi: "Doru Andrei",
      completeness: "complete",
      actual: abs(10000, 40, 10, 4, 5),
      frozenTd: 11000,
    });
    const result = compose(
      [row],
      [MATCH_1, MATCH_2],
      [
        available(
          MATCH_1,
          new Map([
            [
              "Doru Andrei",
              matchOk("Doru Andrei", {
                ...abs(11000, 30, 8, 3, 4),
                durationSeconds: 5480,
              }),
            ],
          ])
        ),
        available(
          MATCH_2,
          new Map([
            [
              "Doru Andrei",
              matchOk("Doru Andrei", {
                ...abs(6500, 20, 6, 2, 3),
                durationSeconds: 2120,
              }),
            ],
          ])
        ),
      ]
    );
    const player = result.rows[0];
    expect(player.quality).toBe("complete");
    expect(player.matches).toHaveLength(2);
    expect(player.total.metrics).toEqual(abs(27500, 90, 24, 9, 12));
    expect(player.total.percentages?.totalDistance).toBe((27500 / 11000) * 100);
    expect(player.match.durationSeconds).toBe(7600);
    expect(player.matches[0].durationSeconds).toBe(5480);
    expect(player.matches[1].durationSeconds).toBe(2120);
    expect(result.officialMatches).toHaveLength(2);
    expect(result.officialMatches[0].mdTag).toBe("MD");
    expect(result.officialMatches[0].sourceStatus).toBe("available");
    expect(result.officialMatches[1].sourceStatus).toBe("available");
  });

  it("D: one pending of two → no final Total, available component preserved, not match_zero", () => {
    const row = training({
      playerId: "p1",
      name: "Doru Andrei",
      pbi: "Doru Andrei",
      completeness: "complete",
      actual: abs(10000),
    });
    const result = compose(
      [row],
      [MATCH_1, MATCH_2],
      [
        available(
          MATCH_1,
          new Map([
            [
              "Doru Andrei",
              matchOk("Doru Andrei", {
                ...abs(5000),
                durationSeconds: 5480,
              }),
            ],
          ])
        ),
        pending(MATCH_2),
      ]
    );
    const player = result.rows[0];
    expect(player.quality).toBe("match_data_pending");
    expect(player.total.metrics).toBeNull();
    expect(player.total.percentages).toBeNull();
    expect(player.matches[0].state).toBe("match_ok");
    expect(player.matches[0].metrics?.totalDistance).toBe(5000);
    expect(player.matches[1].state).toBe("match_data_pending");
    expect(player.matches[1].state).not.toBe("match_zero");
    expect(player.match.quality).toBe("match_data_pending");
    expect(player.match.metrics).toBeNull();
    expect(player.match.durationSeconds).toBeNull();
    expect(result.topValues.totalDistance).toBeNull();
    expect(result.officialMatches[0].sourceStatus).toBe("available");
    expect(result.officialMatches[1].sourceStatus).toBe("pending");
  });

  it("G: proven source + player 0/0 halves remains match_zero with numeric zeros", () => {
    const row = training({
      playerId: "p1",
      name: "Ghost",
      pbi: "Ghost",
      completeness: "complete",
      actual: abs(14000),
    });
    const result = compose(
      [row],
      [MATCH_1],
      [available(MATCH_1, new Map([["Ghost", matchZero("Ghost")]]))]
    );
    expect(result.rows[0].matches[0].state).toBe("match_zero");
    expect(result.rows[0].matches[0].metrics).toEqual(ZERO);
    expect(result.rows[0].quality).toBe("complete");
    expect(result.rows[0].total.metrics?.totalDistance).toBe(14000);
  });

  it("H: one unsafe player Match of two → that player Total unavailable, other player may remain valid", () => {
    const safe = training({
      playerId: "p1",
      name: "Safe",
      pbi: "Safe",
      completeness: "complete",
      actual: abs(10000),
    });
    const unsafe = training({
      playerId: "p2",
      name: "Amb",
      pbi: "Amb",
      completeness: "complete",
      actual: abs(10000),
    });
    const result = compose(
      [safe, unsafe],
      [MATCH_1, MATCH_2],
      [
        available(
          MATCH_1,
          new Map([
            [
              "Safe",
              matchOk("Safe", { ...abs(1000), durationSeconds: 90 }),
            ],
            [
              "Amb",
              {
                playerName: "Amb",
                quality: "match_ambiguous",
                halves: { first: "ambiguous", second: "valid" },
                metrics: null,
              },
            ],
          ])
        ),
        available(
          MATCH_2,
          new Map([
            [
              "Safe",
              matchOk("Safe", { ...abs(2000), durationSeconds: 80 }),
            ],
            [
              "Amb",
              matchOk("Amb", { ...abs(2000), durationSeconds: 80 }),
            ],
          ])
        ),
      ]
    );
    expect(result.rows[0].quality).toBe("complete");
    expect(result.rows[0].total.metrics?.totalDistance).toBe(13000);
    expect(result.rows[1].quality).toBe("unsafe");
    expect(result.rows[1].total.metrics).toBeNull();
    expect(result.rows[1].matches[0].state).toBe("match_ambiguous");
    expect(result.rows[1].matches[1].state).toBe("match_ok");
    expect(result.rows[1].matches[1].metrics?.totalDistance).toBe(2000);
  });

  it("I: Training partial + both Matches safe preserves numeric Partial Total", () => {
    const row = training({
      playerId: "p1",
      name: "Partial",
      pbi: "Partial",
      completeness: "partial_not_found",
      actual: abs(8000, 40, 10, 4, 5),
      frozenTd: 11000,
    });
    const result = compose(
      [row],
      [MATCH_1, MATCH_2],
      [
        available(
          MATCH_1,
          new Map([
            [
              "Partial",
              matchOk("Partial", { ...abs(1000), durationSeconds: 90 }),
            ],
          ])
        ),
        available(
          MATCH_2,
          new Map([
            [
              "Partial",
              matchOk("Partial", { ...abs(2000), durationSeconds: 80 }),
            ],
          ])
        ),
      ]
    );
    expect(result.rows[0].quality).toBe("partial");
    expect(result.rows[0].total.metrics?.totalDistance).toBe(11000);
    expect(result.rows[0].total.percentages?.totalDistance).toBe(100);
  });

  it("J: Top Values still accept Complete + Partial numeric only; pending is ineligible", () => {
    const complete = training({
      playerId: "p1",
      name: "Complete Low",
      pbi: "Complete Low",
      completeness: "complete",
      actual: abs(1000),
    });
    const partial = training({
      playerId: "p2",
      name: "Partial High",
      pbi: "Partial High",
      completeness: "partial_not_found",
      actual: abs(90000),
    });
    const eligible = compose(
      [complete, partial],
      [MATCH_1],
      [
        available(
          MATCH_1,
          new Map([
            ["Complete Low", matchZero("Complete Low")],
            ["Partial High", matchZero("Partial High")],
          ])
        ),
      ]
    );
    expect(eligible.topValues.totalDistance?.playerDisplayName).toBe(
      "Partial High"
    );
    expect(eligible.topValues.totalDistance?.value).toBe(90000);

    const pendingHuge = training({
      playerId: "p3",
      name: "Pending Huge",
      pbi: "Pending Huge",
      completeness: "complete",
      actual: abs(999999),
    });
    const pendingResult = compose(
      [pendingHuge],
      [MATCH_1],
      [pending(MATCH_1)]
    );
    expect(pendingResult.rows[0].quality).toBe("match_data_pending");
    expect(pendingResult.topValues.totalDistance).toBeNull();
  });

  it("zero frozen Best keeps absolute Total and null percentage", () => {
    const row = training({
      playerId: "p1",
      name: "Zero Best",
      pbi: "Zero Best",
      completeness: "complete",
      actual: abs(1000, 10, 5, 2, 3),
      frozenTd: 0,
    });
    const result = compose(
      [row],
      [MATCH_1, MATCH_2],
      [
        available(
          MATCH_1,
          new Map([
            [
              "Zero Best",
              matchOk("Zero Best", { ...abs(500, 10, 5, 2, 3), durationSeconds: 1 }),
            ],
          ])
        ),
        available(
          MATCH_2,
          new Map([
            [
              "Zero Best",
              matchOk("Zero Best", { ...abs(250, 10, 5, 2, 3), durationSeconds: 1 }),
            ],
          ])
        ),
      ]
    );
    expect(result.rows[0].total.metrics?.totalDistance).toBe(1750);
    expect(result.rows[0].total.percentages?.totalDistance).toBeNull();
    expect(result.rows[0].total.percentages?.hsr).toBe((30 / 800) * 100);
  });
});
