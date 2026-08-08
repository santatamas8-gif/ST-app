import { describe, expect, it } from "vitest";

import {
  dateInInclusiveRange,
  isPlannerIsoDate,
  mapPlannerDbError,
  normalizeGroupName,
  normalizeOverloadFocus,
  normalizePowerBiWeekId,
} from "@/lib/gpsPlanner/common";

describe("planner date helpers", () => {
  it("accepts real YYYY-MM-DD and rejects invalid calendars", () => {
    expect(isPlannerIsoDate("2026-03-09")).toBe(true);
    expect(isPlannerIsoDate("2026-02-30")).toBe(false);
    expect(isPlannerIsoDate("2026-3-9")).toBe(false);
  });

  it("preserves inclusive range without timezone shift", () => {
    expect(dateInInclusiveRange("2026-03-09", "2026-03-09", "2026-03-15")).toBe(
      true
    );
    expect(dateInInclusiveRange("2026-03-08", "2026-03-09", "2026-03-15")).toBe(
      false
    );
    expect(dateInInclusiveRange("2026-03-15", "2026-03-09", "2026-03-15")).toBe(
      true
    );
  });
});

describe("week field validation helpers", () => {
  it("trims Power BI week id without inventing W-numbers", () => {
    expect(normalizePowerBiWeekId("  W6  ")).toBe("W6");
    expect(normalizePowerBiWeekId("   ")).toBeNull();
  });

  it("rejects non-overload focus and accepts overload empty focus", () => {
    expect(normalizeOverloadFocus("maintaining", ["td"]).ok).toBe(false);
    expect(normalizeOverloadFocus("overload", []).ok).toBe(true);
    expect(normalizeOverloadFocus("overload", ["hsr"]).ok).toBe(true);
    expect(normalizeOverloadFocus("overload", ["nope"]).ok).toBe(false);
  });

  it("normalizes group names with trim", () => {
    expect(normalizeGroupName("  Starters  ")).toBe("Starters");
    expect(normalizeGroupName(" ")).toBeNull();
  });
});

describe("mapPlannerDbError", () => {
  it("maps known constraint messages", () => {
    expect(
      mapPlannerDbError("t", {
        message:
          'duplicate key value violates unique constraint "planner_weeks_powerbi_week_id_start_date_key"',
      }).code
    ).toBe("duplicate_week");
    expect(
      mapPlannerDbError("t", {
        message: "existing planner_week_days dates fall outside the range",
      }).code
    ).toBe("week_range_conflict");
    expect(
      mapPlannerDbError("t", {
        message: "planner_week_days.date must be between planner_weeks.start_date",
      }).code
    ).toBe("day_outside_week");
  });
});
