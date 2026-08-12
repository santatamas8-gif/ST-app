import { describe, expect, it } from "vitest";

import { aggregateWeeklyActualFromDays } from "@/lib/gpsPlanner/weeklyActualAggregation";
import type { AbsoluteMetrics } from "@/lib/gpsPlanner/calculations";

const planned: AbsoluteMetrics = {
  totalDistance: 1000,
  hsr: 100,
  sprint: 50,
  accelerations: 20,
  decelerations: 20,
};

const actual = (n: number): AbsoluteMetrics => ({
  totalDistance: n,
  hsr: 1,
  sprint: 1,
  accelerations: 1,
  decelerations: 1,
});

describe("aggregateWeeklyActualFromDays", () => {
  it("Player A: 5/5 found → complete", () => {
    const days = Array.from({ length: 5 }, () => ({
      status: "actual_found" as const,
      actual: actual(100),
    }));
    const result = aggregateWeeklyActualFromDays(days, planned);
    expect(result.actualCompleteness).toBe("complete");
    expect(result.weeklyActual?.totalDistance).toBe(500);
    expect(result.weeklyToTarget?.totalDistance).toBe(500);
    expect(result.problematicDays).toBe(0);
  });

  it("Player B: 3 found + 2 not_found → partial_not_found with To Target", () => {
    const days = [
      { status: "actual_not_found" as const, actual: null },
      { status: "actual_not_found" as const, actual: null },
      { status: "actual_found" as const, actual: actual(100) },
      { status: "actual_found" as const, actual: actual(100) },
      { status: "actual_found" as const, actual: actual(100) },
    ];
    const result = aggregateWeeklyActualFromDays(days, planned);
    expect(result.actualCompleteness).toBe("partial_not_found");
    expect(result.foundDays).toBe(3);
    expect(result.notFoundDays).toBe(2);
    expect(result.weeklyActual?.totalDistance).toBe(300);
    expect(result.weeklyToTarget?.totalDistance).toBe(700);
  });

  it("Player C: 4 found + 1 ambiguous → incomplete; To Target withheld", () => {
    const days = [
      { status: "actual_found" as const, actual: actual(100) },
      { status: "actual_found" as const, actual: actual(100) },
      { status: "actual_found" as const, actual: actual(100) },
      { status: "actual_found" as const, actual: actual(100) },
      { status: "actual_ambiguous" as const, actual: null },
    ];
    const result = aggregateWeeklyActualFromDays(days, planned);
    expect(result.actualCompleteness).toBe("incomplete");
    expect(result.weeklyActual?.totalDistance).toBe(400);
    expect(result.weeklyToTarget).toBeNull();
  });

  it("Player D: day technical error → incomplete", () => {
    const days = [
      { status: "actual_found" as const, actual: actual(100) },
      { status: "actual_error" as const, actual: null },
      { status: "actual_found" as const, actual: actual(100) },
    ];
    const result = aggregateWeeklyActualFromDays(days, planned);
    expect(result.actualCompleteness).toBe("incomplete");
    expect(result.weeklyToTarget).toBeNull();
  });

  it("all not_found → weekly Actual and To Target null", () => {
    const days = [
      { status: "actual_not_found" as const, actual: null },
      { status: "actual_not_found" as const, actual: null },
    ];
    const result = aggregateWeeklyActualFromDays(days, planned);
    expect(result.actualCompleteness).toBe("partial_not_found");
    expect(result.weeklyActual).toBeNull();
    expect(result.weeklyToTarget).toBeNull();
  });
});
