import { describe, expect, it } from "vitest";

import type { AbsoluteMetrics } from "@/lib/gpsPlanner/calculations";
import type {
  PlannerWeekOfficialMatch,
  PlannerWeeklyProgressResult,
} from "@/lib/gpsPlanner/types";
import {
  composeTotalLoadResult,
  computeTotalLoadTopValues,
  totalWeekPercentage,
} from "@/lib/gpsPlanner/totalLoadAggregation";
import type { MatchActualPlayerResult } from "@/lib/powerbi/queries/matchActualClassify";

const WEEK = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  powerbiWeekId: "W5",
  startDate: "2026-08-10",
  endDate: "2026-08-14",
};

const MATCH: PlannerWeekOfficialMatch = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  weekId: WEEK.id,
  gpsDate: "2026-08-15",
  opponent: "FK Csikszereda",
  matchday: "Matchday 5",
  competition: null,
  createdBy: null,
  updatedBy: null,
  createdAt: "",
  updatedAt: "",
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
  weeklyPct?: number;
  frozenTd?: number;
  frozenHsr?: number;
}): PlannerWeeklyProgressResult {
  const weeklyPct = input.weeklyPct ?? 80;
  const frozenTd = input.frozenTd ?? 20000;
  return {
    weekId: WEEK.id,
    powerBiWeekId: WEEK.powerbiWeekId,
    playerId: input.playerId,
    playerDisplayName: input.name,
    throughDate: WEEK.endDate,
    frozen: {
      tdBest: frozenTd,
      hsrBest: input.frozenHsr ?? 800,
      sprintBest: 200,
      accBest: 40,
      decBest: 40,
      powerBiPlayerName: input.pbi,
      sourceMethod: "single-match best",
    },
    weeklyPct: {
      tdPct: weeklyPct,
      hsrPct: weeklyPct,
      sprintPct: weeklyPct,
      accPct: weeklyPct,
      decPct: weeklyPct,
    },
    weeklyPlanned: abs(frozenTd * weeklyPct / 100),
    dailyAllocationSum: {
      tdPct: 0,
      hsrPct: 0,
      sprintPct: 0,
      accPct: 0,
      decPct: 0,
    },
    remainingToAllocate: {
      tdPct: weeklyPct,
      hsrPct: weeklyPct,
      sprintPct: weeklyPct,
      accPct: weeklyPct,
      decPct: weeklyPct,
    },
    days: [],
    includedDays: 5,
    foundDays: input.completeness === "complete" ? 5 : 2,
    notFoundDays: input.completeness === "partial_not_found" ? 3 : 0,
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

function compose(
  rows: PlannerWeeklyProgressResult[],
  matchByName: Map<string, MatchActualPlayerResult> | false | null
) {
  return composeTotalLoadResult({
    week: WEEK,
    officialMatch: matchByName === null ? null : MATCH,
    trainingRows: rows,
    matchBatch:
      matchByName === null
        ? null
        : matchByName === false
          ? { ok: false }
          : { ok: true, byPlayerName: matchByName },
  });
}

describe("totalWeekPercentage", () => {
  it("K: zero / invalid frozen Best → null, does not divide", () => {
    expect(totalWeekPercentage(15500, 0)).toBeNull();
    expect(totalWeekPercentage(15500, Number.NaN)).toBeNull();
  });

  it("L: uses frozen snapshot, unrounded", () => {
    expect(totalWeekPercentage(15500, 20000)).toBe(77.5);
  });
});

describe("composeTotalLoadResult", () => {
  it("A: complete Training + match_ok → complete numeric Total", () => {
    const row = training({
      playerId: "p1",
      name: "Doru Andrei",
      pbi: "Doru Andrei",
      completeness: "complete",
      actual: abs(10500, 100, 20, 10, 11),
    });
    const result = compose(
      [row],
      new Map([
        [
          "Doru Andrei",
          matchOk("Doru Andrei", {
            ...abs(5000, 50, 10, 5, 6),
            durationSeconds: 5975,
          }),
        ],
      ])
    );
    const player = result.rows[0];
    expect(player.quality).toBe("complete");
    expect(player.total.metrics).toEqual(abs(15500, 150, 30, 15, 17));
    expect(player.total.percentages?.totalDistance).toBe(77.5);
    expect(player.match.durationSeconds).toBe(5975);
  });

  it("B: complete Training + match_zero → complete, Total = Training", () => {
    const row = training({
      playerId: "p1",
      name: "Ghost",
      pbi: "Ghost",
      completeness: "complete",
      actual: abs(14000),
    });
    const result = compose([row], new Map([["Ghost", matchZero("Ghost")]]));
    expect(result.rows[0].quality).toBe("complete");
    expect(result.rows[0].total.metrics?.totalDistance).toBe(14000);
    expect(result.rows[0].match.metrics).toEqual(ZERO);
    expect(result.rows[0].match.durationSeconds).toBe(0);
  });

  it("C: partial_not_found numeric Training + match_ok → Partial numeric Total", () => {
    const row = training({
      playerId: "p1",
      name: "Partial Player",
      pbi: "Partial Player",
      completeness: "partial_not_found",
      actual: abs(10500, 100, 20, 10, 11),
    });
    const result = compose(
      [row],
      new Map([
        [
          "Partial Player",
          matchOk("Partial Player", {
            ...abs(5000, 50, 10, 5, 6),
            durationSeconds: 2081,
          }),
        ],
      ])
    );
    expect(result.rows[0].quality).toBe("partial");
    expect(result.rows[0].total.metrics).toEqual(abs(15500, 150, 30, 15, 17));
    expect(result.rows[0].total.percentages?.totalDistance).toBe(77.5);
  });

  it("D: partial_not_found numeric + match_zero → Partial Total = recorded Training", () => {
    const row = training({
      playerId: "p1",
      name: "Partial Zero",
      pbi: "Partial Zero",
      completeness: "partial_not_found",
      actual: abs(10500),
    });
    const result = compose(
      [row],
      new Map([["Partial Zero", matchZero("Partial Zero")]])
    );
    expect(result.rows[0].quality).toBe("partial");
    expect(result.rows[0].total.metrics?.totalDistance).toBe(10500);
  });

  it("E: unsafe Training + match_ok → Total unavailable", () => {
    const row = training({
      playerId: "p1",
      name: "Unsafe T",
      pbi: "Unsafe T",
      completeness: "incomplete",
      actual: abs(9000),
    });
    const result = compose(
      [row],
      new Map([
        [
          "Unsafe T",
          matchOk("Unsafe T", { ...abs(5000), durationSeconds: 100 }),
        ],
      ])
    );
    expect(result.rows[0].quality).toBe("unsafe");
    expect(result.rows[0].total.metrics).toBeNull();
    expect(result.rows[0].match.metrics?.totalDistance).toBe(5000);
  });

  it("F: complete Training + match_ambiguous → Total unavailable, not Training-only", () => {
    const row = training({
      playerId: "p1",
      name: "Amb",
      pbi: "Amb",
      completeness: "complete",
      actual: abs(14000),
    });
    const result = compose(
      [row],
      new Map([
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
    );
    expect(result.rows[0].quality).toBe("unsafe");
    expect(result.rows[0].match.quality).toBe("match_ambiguous");
    expect(result.rows[0].total.metrics).toBeNull();
    expect(result.rows[0].match.metrics).toBeNull();
    expect(result.rows[0].match.durationSeconds).toBeNull();
  });

  it("G: complete Training + data_issue → Total unavailable", () => {
    const row = training({
      playerId: "p1",
      name: "Bad",
      pbi: "Bad",
      completeness: "complete",
      actual: abs(14000),
    });
    const result = compose(
      [row],
      new Map([
        [
          "Bad",
          {
            playerName: "Bad",
            quality: "data_issue",
            halves: { first: "valid", second: "absent" },
            metrics: null,
          },
        ],
      ])
    );
    expect(result.rows[0].quality).toBe("unsafe");
    expect(result.rows[0].match.quality).toBe("data_issue");
    expect(result.rows[0].total.metrics).toBeNull();
  });

  it("H: complete Training + match query error → Total unavailable, not match_zero", () => {
    const row = training({
      playerId: "p1",
      name: "Q",
      pbi: "Q",
      completeness: "complete",
      actual: abs(14000),
    });
    const result = compose([row], false);
    expect(result.rows[0].quality).toBe("unsafe");
    expect(result.rows[0].match.quality).toBe("match_query_error");
    expect(result.rows[0].total.metrics).toBeNull();
    expect(result.rows[0].training.metrics?.totalDistance).toBe(14000);
    expect(result.rows[0].match.durationSeconds).toBeNull();
  });

  it("I: no match selected → Total unavailable, not match_zero", () => {
    const row = training({
      playerId: "p1",
      name: "N",
      pbi: "N",
      completeness: "complete",
      actual: abs(14000),
    });
    const result = compose([row], null);
    expect(result.rows[0].quality).toBe("match_not_selected");
    expect(result.rows[0].match.quality).toBe("match_not_selected");
    expect(result.rows[0].total.metrics).toBeNull();
    expect(result.rows[0].training.metrics?.totalDistance).toBe(14000);
    expect(result.officialMatch.selected).toBe(false);
  });

  it("J: missing requested Match result key → unsafe, NOT zero", () => {
    const row = training({
      playerId: "p1",
      name: "Missing",
      pbi: "Missing Name",
      completeness: "complete",
      actual: abs(14000),
    });
    const result = compose([row], new Map());
    expect(result.rows[0].quality).toBe("unsafe");
    expect(result.rows[0].match.quality).toBe("data_issue");
    expect(result.rows[0].total.metrics).toBeNull();
    expect(result.rows[0].match.metrics).toBeNull();
  });

  it("K: zero frozen Best keeps absolute Total, % unavailable for that metric", () => {
    const row = training({
      playerId: "p1",
      name: "Zero Best",
      pbi: "Zero Best",
      completeness: "complete",
      actual: abs(1000, 10, 5, 2, 3),
      frozenTd: 0,
      frozenHsr: 800,
    });
    const result = compose(
      [row],
      new Map([
        [
          "Zero Best",
          matchOk("Zero Best", { ...abs(500, 10, 5, 2, 3), durationSeconds: 1 }),
        ],
      ])
    );
    expect(result.rows[0].quality).toBe("complete");
    expect(result.rows[0].total.metrics?.totalDistance).toBe(1500);
    expect(result.rows[0].total.percentages?.totalDistance).toBeNull();
    expect(result.rows[0].total.percentages?.hsr).toBe((20 / 800) * 100);
  });

  it("M/N: raw decimals unrounded; Acc/Dec summed", () => {
    const row = training({
      playerId: "p1",
      name: "Fabio Vianna",
      pbi: "Fabio Vianna",
      completeness: "complete",
      actual: abs(100.11, 1.11, 2.22, 10, 11),
      frozenTd: 20000,
    });
    const result = compose(
      [row],
      new Map([
        [
          "Fabio Vianna",
          matchOk("Fabio Vianna", {
            ...abs(8978.28, 505.34, 97.97, 66, 67),
            durationSeconds: 5290,
          }),
        ],
      ])
    );
    expect(result.rows[0].total.metrics?.totalDistance).toBeCloseTo(9078.39, 10);
    expect(result.rows[0].total.metrics?.accelerations).toBe(76);
    expect(result.rows[0].total.metrics?.decelerations).toBe(78);
  });

  it("O: Partial excluded from Top Values", () => {
    const partial = training({
      playerId: "p1",
      name: "Partial High",
      pbi: "Partial High",
      completeness: "partial_not_found",
      actual: abs(90000),
    });
    const complete = training({
      playerId: "p2",
      name: "Complete Low",
      pbi: "Complete Low",
      completeness: "complete",
      actual: abs(1000),
    });
    const result = compose(
      [partial, complete],
      new Map([
        ["Partial High", matchZero("Partial High")],
        ["Complete Low", matchZero("Complete Low")],
      ])
    );
    expect(result.topValues.totalDistance?.playerDisplayName).toBe(
      "Complete Low"
    );
    expect(result.topValues.totalDistance?.value).toBe(1000);
  });

  it("P/Q: Complete eligible; match_zero complete remains eligible", () => {
    const row = training({
      playerId: "p1",
      name: "Zero Match",
      pbi: "Zero Match",
      completeness: "complete",
      actual: abs(14000),
    });
    const result = compose(
      [row],
      new Map([["Zero Match", matchZero("Zero Match")]])
    );
    expect(result.topValues.totalDistance).toEqual({
      playerId: "p1",
      playerDisplayName: "Zero Match",
      value: 14000,
    });
  });

  it("R: deterministic Top Values tie → display name ascending", () => {
    const a = training({
      playerId: "p1",
      name: "Beta",
      pbi: "Beta",
      completeness: "complete",
      actual: abs(5000),
    });
    const b = training({
      playerId: "p2",
      name: "Alpha",
      pbi: "Alpha",
      completeness: "complete",
      actual: abs(5000),
    });
    const result = compose(
      [a, b],
      new Map([
        ["Beta", matchZero("Beta")],
        ["Alpha", matchZero("Alpha")],
      ])
    );
    expect(result.topValues.totalDistance?.playerDisplayName).toBe("Alpha");
  });

  it("S/T/U: Weekly Plan same % → number; differing → Mixed; not averaged", () => {
    const same = compose(
      [
        training({
          playerId: "p1",
          name: "A",
          pbi: "A",
          completeness: "complete",
          actual: abs(1),
          weeklyPct: 70,
        }),
        training({
          playerId: "p2",
          name: "B",
          pbi: "B",
          completeness: "complete",
          actual: abs(1),
          weeklyPct: 70,
        }),
      ],
      null
    );
    expect(same.weeklyPlanSummary.td).toBe(70);

    const mixed = compose(
      [
        training({
          playerId: "p1",
          name: "A",
          pbi: "A",
          completeness: "complete",
          actual: abs(1),
          weeklyPct: 70,
        }),
        training({
          playerId: "p2",
          name: "B",
          pbi: "B",
          completeness: "complete",
          actual: abs(1),
          weeklyPct: 80,
        }),
      ],
      null
    );
    expect(mixed.weeklyPlanSummary.td).toBe("Mixed");
    expect(mixed.weeklyPlanSummary.td).not.toBe(75);
  });

  it("partial_not_found with no numeric Training → unsafe, not zero Total", () => {
    const row = training({
      playerId: "p1",
      name: "Empty Partial",
      pbi: "Empty Partial",
      completeness: "partial_not_found",
      actual: null,
    });
    const result = compose(
      [row],
      new Map([["Empty Partial", matchZero("Empty Partial")]])
    );
    expect(result.rows[0].quality).toBe("unsafe");
    expect(result.rows[0].total.metrics).toBeNull();
  });

  it("does not convert missing Training days into zeros in the composer", () => {
    const row = training({
      playerId: "p1",
      name: "Keep",
      pbi: "Keep",
      completeness: "partial_not_found",
      actual: abs(10500),
    });
    const result = compose(
      [row],
      new Map([["Keep", matchOk("Keep", { ...abs(0), durationSeconds: 0 })]])
    );
    expect(result.rows[0].training.metrics?.totalDistance).toBe(10500);
    expect(result.rows[0].total.metrics?.totalDistance).toBe(10500);
  });
});

describe("computeTotalLoadTopValues", () => {
  it("unsafe / match_not_selected / partial are excluded", () => {
    const rows = compose(
      [
        training({
          playerId: "p1",
          name: "No Match",
          pbi: "No Match",
          completeness: "complete",
          actual: abs(99999),
        }),
      ],
      null
    ).rows;
    expect(computeTotalLoadTopValues(rows).totalDistance).toBeNull();
  });
});
