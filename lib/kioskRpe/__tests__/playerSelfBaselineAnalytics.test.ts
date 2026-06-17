import { describe, expect, it } from "vitest";
import {
  addLocalDays,
  buildPlayerSelfBaselineResult,
  calculateMetricDeviation,
  calculateSelfBaselineDateRanges,
  classifySessionPeriod,
} from "@/lib/kioskRpe/playerSelfBaselineAnalytics";
import { makeSession, PLAYER_A } from "./fixtures";

describe("playerSelfBaselineAnalytics date ranges", () => {
  const ranges = calculateSelfBaselineDateRanges("2026-06-17", 7, 28);

  it("defines non-overlapping recent and baseline periods", () => {
    expect(ranges.recentStart).toBe("2026-06-11");
    expect(ranges.recentEnd).toBe("2026-06-17");
    expect(ranges.baselineStart).toBe("2026-05-14");
    expect(ranges.baselineEnd).toBe("2026-06-10");
    expect(ranges.baselineEnd < ranges.recentStart).toBe(true);
  });

  it("uses inclusive period boundaries", () => {
    expect(classifySessionPeriod("2026-06-11", ranges)).toBe("recent");
    expect(classifySessionPeriod("2026-06-17", ranges)).toBe("recent");
    expect(classifySessionPeriod("2026-05-14", ranges)).toBe("baseline");
    expect(classifySessionPeriod("2026-06-10", ranges)).toBe("baseline");
    expect(classifySessionPeriod("2026-05-13", ranges)).toBe("outside");
  });

  it("handles month and year transitions", () => {
    const month = calculateSelfBaselineDateRanges("2026-03-05", 7, 28);
    expect(month.recentStart).toBe("2026-02-27");
    expect(month.baselineEnd).toBe("2026-02-26");

    const year = calculateSelfBaselineDateRanges("2026-01-03", 7, 28);
    expect(year.recentStart).toBe("2025-12-28");
    expect(year.baselineEnd).toBe("2025-12-27");
  });

  it("handles leap-day transition", () => {
    expect(addLocalDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addLocalDays("2024-02-29", 1)).toBe("2024-03-01");
  });
});

describe("playerSelfBaselineAnalytics metrics and deviation", () => {
  const ranges = calculateSelfBaselineDateRanges("2026-06-17", 7, 28);
  const sessions = [
    makeSession({ id: "r1", user_id: PLAYER_A, date: "2026-06-15", rpe: 8, duration: 70, load: 560 }),
    makeSession({ id: "r2", user_id: PLAYER_A, date: "2026-06-16", rpe: 8, duration: 70, load: 560 }),
    makeSession({ id: "r3", user_id: PLAYER_A, date: "2026-06-17", rpe: 8, duration: 70, load: 560 }),
    makeSession({ id: "b1", user_id: PLAYER_A, date: "2026-05-20", rpe: 6, duration: 60, load: 360 }),
    makeSession({ id: "b2", user_id: PLAYER_A, date: "2026-05-21", rpe: 6, duration: 60, load: 360 }),
    makeSession({ id: "b3", user_id: PLAYER_A, date: "2026-05-22", rpe: 6, duration: 60, load: 360 }),
  ];

  it("calculates period metrics from individual sessions", () => {
    const result = buildPlayerSelfBaselineResult(sessions, {
      playerId: PLAYER_A,
      ranges,
      matchdayTag: "All matchday tags",
      sessionType: "All session types",
    });

    expect(result.recent.sessionCount).toBe(3);
    expect(result.baseline.sessionCount).toBe(3);
    expect(result.recent.averageRpe).toBe(8);
    expect(result.baseline.averageRpe).toBe(6);
    expect(result.recent.averageDuration).toBe(70);
    expect(result.baseline.averageDuration).toBe(60);
    expect(result.recent.averageLoad).toBe(560);
    expect(result.baseline.averageLoad).toBe(360);
    expect(result.recent.totalLoad).toBe(1680);
    expect(result.baseline.totalLoad).toBe(1080);
  });

  it("calculates deviation percentages and labels", () => {
    const higher = calculateMetricDeviation(460, 400, false);
    expect(higher.absoluteDifference).toBe(60);
    expect(higher.percentageDifference).toBeCloseTo(15, 5);
    expect(higher.interpretation).toBe("higher");

    const lower = calculateMetricDeviation(380, 400, false);
    expect(lower.absoluteDifference).toBe(-20);
    expect(lower.percentageDifference).toBeCloseTo(-5, 5);
    expect(lower.interpretation).toBe("similar");

    const similar = calculateMetricDeviation(410, 400, false);
    expect(similar.interpretation).toBe("similar");

    const above = calculateMetricDeviation(430, 400, false);
    expect(above.interpretation).toBe("higher");

    const below = calculateMetricDeviation(370, 400, false);
    expect(below.interpretation).toBe("lower");
  });

  it("handles zero or missing baseline and limited sample size", () => {
    const zeroBaseline = calculateMetricDeviation(100, 0, false);
    expect(zeroBaseline.percentageDifference).toBeNull();
    expect(zeroBaseline.interpretation).toBe("insufficient");

    const missing = calculateMetricDeviation(100, null, false);
    expect(missing.interpretation).toBe("insufficient");

    const limited = buildPlayerSelfBaselineResult(
      [makeSession({ id: "only", user_id: PLAYER_A, date: "2026-06-17", rpe: 7, duration: 75, load: 525 })],
      {
        playerId: PLAYER_A,
        ranges,
        matchdayTag: "All matchday tags",
        sessionType: "All session types",
      }
    );
    expect(limited.limitedData).toBe(true);
    expect(limited.deviations.averageLoad.interpretation).toBe("insufficient");
  });
});
