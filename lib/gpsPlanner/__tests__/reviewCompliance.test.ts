import { describe, expect, it } from "vitest";
import {
  dailyComplianceTone,
  reviewComplianceToneClass,
  weeklyComplianceTone,
} from "@/lib/gpsPlanner/reviewCompliance";

describe("weeklyComplianceTone (player-specific Weekly Target %)", () => {
  it("uses each player's own TD target ±20 pp", () => {
    // Player A target 200% → green 180–220
    expect(
      weeklyComplianceTone({
        metric: "td",
        actual: 2000,
        matchBest: 1000,
        weeklyTargetPct: 200,
        actualCompleteness: "complete",
      })
    ).toBe("green");
    expect(
      weeklyComplianceTone({
        metric: "td",
        actual: 1799,
        matchBest: 1000,
        weeklyTargetPct: 200,
        actualCompleteness: "complete",
      })
    ).toBe("orange");
    expect(
      weeklyComplianceTone({
        metric: "td",
        actual: 2201,
        matchBest: 1000,
        weeklyTargetPct: 200,
        actualCompleteness: "complete",
      })
    ).toBe("red");

    // Player B target 250% → green 230–270
    expect(
      weeklyComplianceTone({
        metric: "td",
        actual: 2500,
        matchBest: 1000,
        weeklyTargetPct: 250,
        actualCompleteness: "complete",
      })
    ).toBe("green");
    expect(
      weeklyComplianceTone({
        metric: "td",
        actual: 2299,
        matchBest: 1000,
        weeklyTargetPct: 250,
        actualCompleteness: "complete",
      })
    ).toBe("orange");
    expect(
      weeklyComplianceTone({
        metric: "td",
        actual: 2701,
        matchBest: 1000,
        weeklyTargetPct: 250,
        actualCompleteness: "complete",
      })
    ).toBe("red");
  });

  it("uses Sprint ±10 pp around that player's target", () => {
    expect(
      weeklyComplianceTone({
        metric: "sprint",
        actual: 100,
        matchBest: 100,
        weeklyTargetPct: 100,
        actualCompleteness: "complete",
      })
    ).toBe("green");
    expect(
      weeklyComplianceTone({
        metric: "sprint",
        actual: 89,
        matchBest: 100,
        weeklyTargetPct: 100,
        actualCompleteness: "complete",
      })
    ).toBe("orange");
    expect(
      weeklyComplianceTone({
        metric: "sprint",
        actual: 111,
        matchBest: 100,
        weeklyTargetPct: 100,
        actualCompleteness: "complete",
      })
    ).toBe("red");
  });

  it("includes green band edges", () => {
    expect(
      weeklyComplianceTone({
        metric: "hsr",
        actual: 130,
        matchBest: 100,
        weeklyTargetPct: 150,
        actualCompleteness: "complete",
      })
    ).toBe("green");
    expect(
      weeklyComplianceTone({
        metric: "hsr",
        actual: 170,
        matchBest: 100,
        weeklyTargetPct: 150,
        actualCompleteness: "complete",
      })
    ).toBe("green");
  });

  it("returns null when Actual, Match Best, or Weekly Target % missing", () => {
    expect(
      weeklyComplianceTone({
        metric: "td",
        actual: null,
        matchBest: 1000,
        weeklyTargetPct: 250,
        actualCompleteness: "complete",
      })
    ).toBeNull();
    expect(
      weeklyComplianceTone({
        metric: "td",
        actual: 1000,
        matchBest: null,
        weeklyTargetPct: 250,
        actualCompleteness: "complete",
      })
    ).toBeNull();
    expect(
      weeklyComplianceTone({
        metric: "td",
        actual: 1000,
        matchBest: 1000,
        weeklyTargetPct: null,
        actualCompleteness: "complete",
      })
    ).toBeNull();
  });

  it("keeps incomplete / partial Actual quality neutral", () => {
    expect(
      weeklyComplianceTone({
        metric: "td",
        actual: 2500,
        matchBest: 1000,
        weeklyTargetPct: 250,
        actualCompleteness: "incomplete",
      })
    ).toBeNull();
    expect(
      weeklyComplianceTone({
        metric: "td",
        actual: 2500,
        matchBest: 1000,
        weeklyTargetPct: 250,
        actualCompleteness: "partial_not_found",
      })
    ).toBeNull();
  });
});

describe("dailyComplianceTone (Difference = Planned − Actual)", () => {
  it("marks exceeded load red (diff < 0)", () => {
    expect(dailyComplianceTone({ metric: "td", difference: -1 })).toBe("red");
    expect(dailyComplianceTone({ metric: "hsr", difference: -10 })).toBe("red");
  });

  it("applies unified green / orange thresholds", () => {
    expect(dailyComplianceTone({ metric: "td", difference: 0 })).toBe("green");
    expect(dailyComplianceTone({ metric: "td", difference: 500 })).toBe(
      "green"
    );
    expect(dailyComplianceTone({ metric: "td", difference: 501 })).toBe(
      "orange"
    );

    expect(dailyComplianceTone({ metric: "hsr", difference: 100 })).toBe(
      "green"
    );
    expect(dailyComplianceTone({ metric: "hsr", difference: 101 })).toBe(
      "orange"
    );

    expect(dailyComplianceTone({ metric: "sprint", difference: 50 })).toBe(
      "green"
    );
    expect(dailyComplianceTone({ metric: "sprint", difference: 51 })).toBe(
      "orange"
    );

    expect(dailyComplianceTone({ metric: "acc", difference: 10 })).toBe(
      "green"
    );
    expect(dailyComplianceTone({ metric: "acc", difference: 11 })).toBe(
      "orange"
    );

    expect(dailyComplianceTone({ metric: "dec", difference: 10 })).toBe(
      "green"
    );
    expect(dailyComplianceTone({ metric: "dec", difference: 11 })).toBe(
      "orange"
    );
  });

  it("returns null when Difference missing", () => {
    expect(dailyComplianceTone({ metric: "td", difference: null })).toBeNull();
  });
});

describe("reviewComplianceToneClass", () => {
  it("maps tones to mild Tailwind classes", () => {
    expect(reviewComplianceToneClass("green")).toContain("emerald");
    expect(reviewComplianceToneClass("orange")).toContain("amber");
    expect(reviewComplianceToneClass("red")).toContain("red");
    expect(reviewComplianceToneClass(null)).toContain("zinc");
  });
});
