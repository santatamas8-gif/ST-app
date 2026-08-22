import { describe, expect, it } from "vitest";

import {
  calculateDailyPlannedAbsolutes,
  calculateWeeklyPlannedAbsolutes,
  differenceAbsolute,
  plannedAbsolute,
  remainingToAllocate,
  sumAbsoluteMetrics,
  sumPercentageMetrics,
} from "@/lib/gpsPlanner/calculations";

describe("plannedAbsolute / daily planned", () => {
  it("computes best * pct / 100 without rounding", () => {
    expect(plannedAbsolute(800, 140)).toBe(1120);
    expect(plannedAbsolute(328, 120)).toBe(393.6);
    expect(plannedAbsolute(100, 140.5)).toBe(140.5);
    expect(plannedAbsolute(0, 400)).toBe(0);
    expect(plannedAbsolute(800, 50)).toBe(400);
    expect(plannedAbsolute(328, 37.5)).toBe(123);
  });

  it("pairs daily metrics without cross-wiring", () => {
    const planned = calculateDailyPlannedAbsolutes(
      {
        tdBest: 800,
        hsrBest: 328,
        sprintBest: 100,
        accBest: 40,
        decBest: 35,
      },
      {
        tdPct: 50,
        hsrPct: 37.5,
        sprintPct: 140.5,
        accPct: 10,
        decPct: 20,
      }
    );
    expect(planned.totalDistance).toBe(400);
    expect(planned.hsr).toBe(123);
    expect(planned.sprint).toBe(140.5);
    expect(planned.accelerations).toBe(4);
    expect(planned.decelerations).toBe(7);
  });
});

describe("differenceAbsolute", () => {
  it("uses Planned - Actual sign convention", () => {
    expect(
      differenceAbsolute(
        {
          totalDistance: 400,
          hsr: 400,
          sprint: 120,
          accelerations: 10,
          decelerations: 10,
        },
        {
          totalDistance: 400,
          hsr: 355,
          sprint: 138,
          accelerations: 10,
          decelerations: 10,
        }
      )
    ).toEqual({
      totalDistance: 0,
      hsr: 45,
      sprint: -18,
      accelerations: 0,
      decelerations: 0,
    });
  });
});

describe("allocation remaining", () => {
  it("computes remaining independently per metric", () => {
    const weekly = {
      tdPct: 140,
      hsrPct: 140,
      sprintPct: 140,
      accPct: 140,
      decPct: 140,
    };
    expect(
      remainingToAllocate(weekly, {
        tdPct: 130,
        hsrPct: 130,
        sprintPct: 130,
        accPct: 130,
        decPct: 130,
      }).hsrPct
    ).toBe(10);
    expect(
      remainingToAllocate(weekly, {
        tdPct: 140,
        hsrPct: 140,
        sprintPct: 140,
        accPct: 140,
        decPct: 140,
      }).hsrPct
    ).toBe(0);
    expect(
      remainingToAllocate(weekly, {
        tdPct: 155,
        hsrPct: 155,
        sprintPct: 155,
        accPct: 155,
        decPct: 155,
      }).hsrPct
    ).toBe(-15);
  });

  it("sums daily percentages without auto-correction", () => {
    const sum = sumPercentageMetrics([
      { tdPct: 10, hsrPct: 10, sprintPct: 10, accPct: 10, decPct: 10 },
      { tdPct: 30, hsrPct: 30, sprintPct: 30, accPct: 30, decPct: 30 },
      { tdPct: 50, hsrPct: 50, sprintPct: 50, accPct: 50, decPct: 50 },
      { tdPct: 40, hsrPct: 40, sprintPct: 40, accPct: 40, decPct: 40 },
    ]);
    expect(sum.hsrPct).toBe(130);
  });
});

describe("weekly planned source", () => {
  it("comes from weekly target not daily sum", () => {
    const weekly = calculateWeeklyPlannedAbsolutes(
      {
        tdBest: 800,
        hsrBest: 800,
        sprintBest: 100,
        accBest: 40,
        decBest: 35,
      },
      { tdPct: 140, hsrPct: 140, sprintPct: 100, accPct: 100, decPct: 100 }
    );
    expect(weekly.hsr).toBe(1120);
    // Daily sum of planned would be lower — weekly planned stays 1120.
    const dailySum = sumAbsoluteMetrics([
      { totalDistance: 0, hsr: 400, sprint: 0, accelerations: 0, decelerations: 0 },
      { totalDistance: 0, hsr: 560, sprint: 0, accelerations: 0, decelerations: 0 },
    ]);
    expect(dailySum.hsr).toBe(960);
    expect(weekly.hsr).not.toBe(dailySum.hsr);
  });

  it("same weekly % with different frozen bests yields different raw absolutes", () => {
    const pct = {
      tdPct: 180,
      hsrPct: 100,
      sprintPct: 90,
      accPct: 250,
      decPct: 250,
    };
    const playerA = calculateWeeklyPlannedAbsolutes(
      {
        tdBest: 10000,
        hsrBest: 800,
        sprintBest: 200,
        accBest: 40,
        decBest: 36,
      },
      pct
    );
    const playerB = calculateWeeklyPlannedAbsolutes(
      {
        tdBest: 9000,
        hsrBest: 700,
        sprintBest: 150,
        accBest: 30,
        decBest: 28,
      },
      pct
    );
    expect(playerA.totalDistance).toBe(18000);
    expect(playerB.totalDistance).toBe(16200);
    expect(playerA.hsr).toBe(800);
    expect(playerB.hsr).toBe(700);
    expect(playerA.sprint).toBe(180);
    expect(playerB.sprint).toBe(135);
    expect(playerA.accelerations).toBe(100);
    expect(playerB.accelerations).toBe(75);
    expect(playerA.decelerations).toBe(90);
    expect(playerB.decelerations).toBe(70);
    expect(playerA).not.toEqual(playerB);
  });
});
