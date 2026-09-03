import { describe, expect, it } from "vitest";
import {
  WEEKLY_BENCHMARK_REFERENCE,
  WEEK_STATUS_HELP,
  WEEK_STATUS_ORG_NOTE,
  allocationStatusLabel,
  defaultThroughDate,
  formatBulkApplyOutcomeStatus,
  formatMetricUnit,
  formatPlannerDisplayAbsolute,
  formatProgressDayStatus,
  formatWeekOptionLabel,
  plannerErrorMessage,
} from "@/lib/gpsPlanner/uiDisplay";

describe("formatPlannerDisplayAbsolute", () => {
  it("rounds for display only", () => {
    expect(formatPlannerDisplayAbsolute(10.4)).toBe(10);
    expect(formatPlannerDisplayAbsolute(10.5)).toBe(11);
    expect(formatPlannerDisplayAbsolute(0)).toBe(0);
  });
});

describe("formatMetricUnit", () => {
  it("returns m or count", () => {
    expect(formatMetricUnit("td")).toBe("m");
    expect(formatMetricUnit("hsr")).toBe("m");
    expect(formatMetricUnit("sprint")).toBe("m");
    expect(formatMetricUnit("acc")).toBe("count");
    expect(formatMetricUnit("dec")).toBe("count");
  });
});

describe("allocationStatusLabel", () => {
  it("labels remaining / full / over in coach language", () => {
    expect(allocationStatusLabel(40)).toEqual({
      kind: "remaining",
      text: "40% remaining",
    });
    expect(allocationStatusLabel(0)).toEqual({
      kind: "full",
      text: "Fully allocated",
    });
    expect(allocationStatusLabel(-15)).toEqual({
      kind: "over",
      text: "15% over-allocated",
    });
  });
});

describe("week status helpers", () => {
  it("explains organizational labels only", () => {
    expect(WEEK_STATUS_HELP.draft.meaning).toMatch(/Planning/i);
    expect(WEEK_STATUS_HELP.active.meaning).toMatch(/Current week/i);
    expect(WEEK_STATUS_HELP.closed.meaning).toMatch(/historical/i);
    expect(WEEK_STATUS_ORG_NOTE).toMatch(/does not lock editing/i);
  });
});

describe("formatProgressDayStatus", () => {
  it("humanizes raw Actual status enums", () => {
    expect(formatProgressDayStatus("actual_found")).toBe("Found");
    expect(formatProgressDayStatus("actual_not_found")).toBe("No data");
    expect(formatProgressDayStatus("actual_ambiguous")).toBe(
      "Ambiguous (not summed)"
    );
    expect(formatProgressDayStatus("actual_error")).toBe("Unavailable");
    expect(formatProgressDayStatus("actual_incomplete")).toBe("Incomplete");
  });
});

describe("formatBulkApplyOutcomeStatus", () => {
  it("formats created / updated / failed", () => {
    expect(formatBulkApplyOutcomeStatus("created")).toEqual({
      mark: "✓",
      label: "Created",
      tone: "ok",
    });
    expect(formatBulkApplyOutcomeStatus("updated").label).toBe("Updated");
    expect(formatBulkApplyOutcomeStatus("failed")).toEqual({
      mark: "!",
      label: "Failed",
      tone: "fail",
    });
  });
});

describe("defaultThroughDate", () => {
  it("clamps today into the week", () => {
    expect(defaultThroughDate("2026-03-09", "2026-03-15", "2026-03-12")).toBe(
      "2026-03-12"
    );
    expect(defaultThroughDate("2026-03-09", "2026-03-15", "2026-03-01")).toBe(
      "2026-03-09"
    );
    expect(defaultThroughDate("2026-03-09", "2026-03-15", "2026-03-20")).toBe(
      "2026-03-15"
    );
  });
});

describe("plannerErrorMessage", () => {
  it("maps common codes into Admin language", () => {
    expect(plannerErrorMessage("unauthorized")).toBe("Admin access required.");
    expect(plannerErrorMessage("confirmation_required")).toMatch(/confirm/i);
    expect(plannerErrorMessage("mapping_not_found")).toMatch(
      /Power BI mapping not set/i
    );
    expect(plannerErrorMessage("match_best_not_found")).toBe(
      "Match Best not found in Power BI"
    );
    expect(plannerErrorMessage("actual_not_found")).toBe(
      "No training Actual found in Power BI for this day."
    );
    expect(plannerErrorMessage("actual_ambiguous")).toBe(
      "Multiple training Actual rows found — not summed."
    );
    expect(plannerErrorMessage("unknown_code", "Custom")).toBe("Custom");
    expect(plannerErrorMessage("totally_unknown")).toMatch(/planner/i);
  });
});

describe("WEEKLY_BENCHMARK_REFERENCE", () => {
  it("is labeled reference-only and has week-type ranges", () => {
    expect(WEEKLY_BENCHMARK_REFERENCE.label).toMatch(/reference/i);
    expect(WEEKLY_BENCHMARK_REFERENCE.ranges.deload.td).toBeTruthy();
    expect(WEEKLY_BENCHMARK_REFERENCE.ranges.maintaining.hsr).toBeTruthy();
    expect(WEEKLY_BENCHMARK_REFERENCE.ranges.overload.acc).toBeTruthy();
  });
});

describe("formatWeekOptionLabel", () => {
  it("formats week option", () => {
    expect(formatWeekOptionLabel("W6", "2026-03-09", "2026-03-15")).toBe(
      "W6 · 2026-03-09 – 2026-03-15"
    );
  });
});
