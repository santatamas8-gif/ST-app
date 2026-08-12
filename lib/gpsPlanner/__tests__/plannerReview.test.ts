import { describe, expect, it } from "vitest";
import {
  differenceAbsolute,
  plannedAbsolute,
} from "@/lib/gpsPlanner/calculations";
import {
  defaultThroughDate,
  formatDailyReviewActualQuality,
  formatPlannerDisplayAbsoluteOrDash,
  formatPlannerDisplaySignedAbsolute,
  formatWeeklyReviewActualQuality,
  resolveReviewDayIdForWeekDays,
  resolveReviewThroughDateForWeek,
} from "@/lib/gpsPlanner/uiDisplay";

describe("Review display helpers", () => {
  it("formats signed To Target / Difference with + for positive", () => {
    expect(formatPlannerDisplaySignedAbsolute(1879.4)).toBe("+1,879");
    expect(formatPlannerDisplaySignedAbsolute(0)).toBe("0");
    expect(formatPlannerDisplaySignedAbsolute(-238.2)).toBe("-238");
    expect(formatPlannerDisplaySignedAbsolute(null)).toBe("—");
  });

  it("formats absolute or dash without inventing zero", () => {
    expect(formatPlannerDisplayAbsoluteOrDash(3872.4)).toBe("3,872");
    expect(formatPlannerDisplayAbsoluteOrDash(null)).toBe("—");
  });

  it("maps weekly completeness to coach labels", () => {
    expect(
      formatWeeklyReviewActualQuality({
        actualCompleteness: "complete",
        includedDays: 3,
        foundDays: 3,
        notFoundDays: 0,
        problematicDays: 0,
      })
    ).toBe("Complete");
    expect(
      formatWeeklyReviewActualQuality({
        actualCompleteness: "partial_not_found",
        includedDays: 3,
        foundDays: 2,
        notFoundDays: 1,
        problematicDays: 0,
      })
    ).toBe("Incomplete");
    expect(
      formatWeeklyReviewActualQuality({
        actualCompleteness: "partial_not_found",
        includedDays: 3,
        foundDays: 0,
        notFoundDays: 3,
        problematicDays: 0,
      })
    ).toBe("No data");
    expect(
      formatWeeklyReviewActualQuality({
        actualCompleteness: "incomplete",
        includedDays: 3,
        foundDays: 1,
        notFoundDays: 1,
        problematicDays: 1,
      })
    ).toBe("Data issue");
    expect(
      formatWeeklyReviewActualQuality({
        actualCompleteness: "partial_not_found",
        includedDays: 0,
        foundDays: 0,
        notFoundDays: 0,
        problematicDays: 0,
      })
    ).toBe("No data");
  });

  it("maps daily Actual statuses to coach labels", () => {
    expect(formatDailyReviewActualQuality("actual_found")).toBe("Complete");
    expect(formatDailyReviewActualQuality("actual_not_found")).toBe("No data");
    expect(formatDailyReviewActualQuality("actual_ambiguous")).toBe(
      "Data issue"
    );
    expect(formatDailyReviewActualQuality("actual_error")).toBe("Unavailable");
    expect(formatDailyReviewActualQuality(null)).toBe("No data");
  });
});

describe("Review sign convention (Planned − Actual)", () => {
  it("covers positive, zero, and negative", () => {
    expect(
      differenceAbsolute(
        {
          totalDistance: 6000,
          hsr: 0,
          sprint: 0,
          accelerations: 0,
          decelerations: 0,
        },
        {
          totalDistance: 5500,
          hsr: 0,
          sprint: 0,
          accelerations: 0,
          decelerations: 0,
        }
      ).totalDistance
    ).toBe(500);
    expect(
      differenceAbsolute(
        {
          totalDistance: 6000,
          hsr: 0,
          sprint: 0,
          accelerations: 0,
          decelerations: 0,
        },
        {
          totalDistance: 6000,
          hsr: 0,
          sprint: 0,
          accelerations: 0,
          decelerations: 0,
        }
      ).totalDistance
    ).toBe(0);
    expect(
      differenceAbsolute(
        {
          totalDistance: 6000,
          hsr: 0,
          sprint: 0,
          accelerations: 0,
          decelerations: 0,
        },
        {
          totalDistance: 6500,
          hsr: 0,
          sprint: 0,
          accelerations: 0,
          decelerations: 0,
        }
      ).totalDistance
    ).toBe(-500);
  });

  it("Weekly/Daily Planned remains Best × %", () => {
    expect(plannedAbsolute(10000, 50)).toBe(5000);
    expect(plannedAbsolute(800, 41)).toBe(328);
  });
});

describe("Historical Review identity contract", () => {
  it("documents frozen Power BI name for historical weeks (domain assertion)", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const progressSrc = await fs.readFile(
      path.join(process.cwd(), "lib/gpsPlanner/progress.server.ts"),
      "utf8"
    );
    expect(progressSrc).toContain(
      "frozen snapshot.powerbi_player_name (NEVER current mapping)"
    );
    expect(progressSrc).toContain("getTrainingActualGps");
    expect(progressSrc).not.toMatch(
      /getTrainingActualGps\([\s\S]*getPlayerMapping/
    );
    expect(progressSrc).not.toContain("getPlayerMapping");
    expect(progressSrc).not.toContain("player_external_mappings");
  });
});

describe("Review through-date / day validity on week change", () => {
  it("C: changing Review Week clamps Through Date into the new week range", () => {
    const next = resolveReviewThroughDateForWeek({
      previousWeekId: "w4",
      nextWeekId: "w5",
      previousThroughDate: "2026-08-07",
      nextWeekStart: "2026-08-11",
      nextWeekEnd: "2026-08-17",
      todayIso: "2026-08-09",
    });
    expect(next).toBe(defaultThroughDate("2026-08-11", "2026-08-17", "2026-08-09"));
    expect(next).toBe("2026-08-11");
  });

  it("preserves Through Date when week is unchanged and date still valid", () => {
    expect(
      resolveReviewThroughDateForWeek({
        previousWeekId: "w4",
        nextWeekId: "w4",
        previousThroughDate: "2026-08-07",
        nextWeekStart: "2026-08-04",
        nextWeekEnd: "2026-08-10",
        todayIso: "2026-08-09",
      })
    ).toBe("2026-08-07");
  });

  it("D: stale Daily Week Day is replaced by a valid day from the new Week", () => {
    expect(resolveReviewDayIdForWeekDays("day-w4-md3", ["day-w5-a", "day-w5-b"])).toBe(
      "day-w5-a"
    );
    expect(
      resolveReviewDayIdForWeekDays("day-w5-b", ["day-w5-a", "day-w5-b"])
    ).toBe("day-w5-b");
    expect(resolveReviewDayIdForWeekDays("x", [])).toBe("");
  });
});

describe("Planner Review UI contract", () => {
  it("Planning | Review shell exists; no stacked Review under Planning; no new sidebar route", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const shell = await fs.readFile(
      path.join(
        process.cwd(),
        "app/(app)/admin/planner/GpsLoadPlannerView.tsx"
      ),
      "utf8"
    );
    const page = await fs.readFile(
      path.join(process.cwd(), "app/(app)/admin/planner/page.tsx"),
      "utf8"
    );
    const nav = await fs.readFile(
      path.join(process.cwd(), "lib/gpsPlanner/nav.ts"),
      "utf8"
    );
    const review = await fs.readFile(
      path.join(process.cwd(), "app/(app)/admin/planner/PlannerReviewView.tsx"),
      "utf8"
    );
    const planning = await fs.readFile(
      path.join(process.cwd(), "app/(app)/admin/planner/WeeklyPlannerView.tsx"),
      "utf8"
    );

    expect(shell).toContain("Planning");
    expect(shell).toContain("Review");
    expect(shell).toContain('useState<TopMode>("planning")');
    expect(shell).toContain("WeeklyPlannerView");
    expect(shell).toContain("PlannerReviewView");
    expect(shell).toContain('mode === "planning" ? "block" : "hidden"');
    expect(shell).toContain('mode === "review" ? "block" : "hidden"');
    expect(shell).toContain("reviewTab");
    expect(shell).toContain("reviewThroughDate");
    expect(shell).toContain("reviewDayId");
    expect(shell).toContain("reviewMounted");
    expect(shell).toContain("reviewOpenedOnce");
    expect(page).toContain("GpsLoadPlannerView");
    expect(page).toContain("GPS Load Planner");
    expect(nav).toContain('href: "/admin/planner"');
    expect(nav).not.toContain("/admin/planner/history");
    expect(nav).not.toContain("/admin/planner/review");

    expect(review).toContain("Weekly");
    expect(review).toContain("Daily");
    expect(review).toContain("onTabChange");
    expect(review).toContain("Through date");
    expect(review).toContain("getPlannerWeeklyReviewProgressAction");
    expect(review).toContain("getPlannerDailyAnalysisAction");
    expect(review).toContain("listPlannerWeeklyTargetsAction");
    expect(review).toContain("resolveReviewThroughDateForWeek");
    expect(review).toContain("resolveReviewDayIdForWeekDays");
    expect(review).not.toContain("getPlannerWeeklyProgressAction");
    expect(review).not.toContain("getPlayerMapping");
    expect(review).not.toContain("injury");
    expect(review).not.toContain("underloaded");

    // E: Planning behavior wiring unchanged (still receives onWeekIdChange only).
    expect(planning).toContain("onWeekIdChange");
    expect(shell).toContain("onWeekIdChange={onPlanningWeekIdChange}");
  });

  it("A/B/F: shell owns Review nav state; both panes mount/hide; Review not remounted on Planning switch", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const shell = await fs.readFile(
      path.join(
        process.cwd(),
        "app/(app)/admin/planner/GpsLoadPlannerView.tsx"
      ),
      "utf8"
    );

    // A/B: controlled props preserve tab / throughDate / dayId across mode switches.
    expect(shell).toContain("tab={reviewTab}");
    expect(shell).toContain("throughDate={reviewThroughDate}");
    expect(shell).toContain("dayId={reviewDayId}");
    expect(shell).toContain("weekId={reviewWeekId}");

    // After first open, Review stays mounted (hidden) — no remount reset.
    expect(shell).toContain("reviewMounted");
    expect(shell).toContain('{reviewMounted ? (');
    expect(shell).not.toContain('{mode === "review" ? (\n        <PlannerReviewView');

    // F: only one top-level view visible (hidden/block toggles).
    expect(shell).toContain('mode === "planning" ? "block" : "hidden"');
    expect(shell).toContain('mode === "review" ? "block" : "hidden"');

    // First Review open may sync Planning week; later switches do not.
    expect(shell).toContain("reviewOpenedOnce");
    expect(shell).toContain("if (!reviewOpenedOnce)");
  });

  it("Weekly Review uses day-batched Actual; Daily Review stays sequential per player", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const review = await fs.readFile(
      path.join(process.cwd(), "app/(app)/admin/planner/PlannerReviewView.tsx"),
      "utf8"
    );
    const progress = await fs.readFile(
      path.join(process.cwd(), "lib/gpsPlanner/progress.server.ts"),
      "utf8"
    );
    expect(review).toContain("getPlannerWeeklyReviewProgressAction");
    expect(review).not.toContain("getPlannerWeeklyProgressAction");
    expect(review).toContain("getPlannerDailyAnalysisAction");
    expect(review).toContain("for (const t of targets)");
    expect(review).not.toContain("Promise.all(targets");
    expect(progress).toContain("getTrainingActualGpsBatchForDay");
    expect(progress).toContain("getTrainingActualGps");
  });

  it("uses semantic third-column labels: Weekly To Target / Daily Difference", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const review = await fs.readFile(
      path.join(process.cwd(), "app/(app)/admin/planner/PlannerReviewView.tsx"),
      "utf8"
    );

    expect(review).toContain(
      'const WEEKLY_SUB_COLS = ["Actual", "Planned", "To Target"] as const'
    );
    expect(review).toContain(
      'const DAILY_SUB_COLS = ["Actual", "Planned", "Difference"] as const'
    );
    expect(review).toContain("<ReviewTableHead subCols={WEEKLY_SUB_COLS} />");
    expect(review).toContain("<ReviewTableHead subCols={DAILY_SUB_COLS} />");
    expect(review).not.toMatch(
      /SUB_COLS\s*=\s*\["Actual",\s*"Planned",\s*"Diff"\]/
    );

    // Same sign convention for both labels (presentation-only rename).
    expect(
      differenceAbsolute(
        {
          totalDistance: 6000,
          hsr: 100,
          sprint: 50,
          accelerations: 10,
          decelerations: 8,
        },
        {
          totalDistance: 5500,
          hsr: 80,
          sprint: 40,
          accelerations: 9,
          decelerations: 7,
        }
      )
    ).toEqual({
      totalDistance: 500,
      hsr: 20,
      sprint: 10,
      accelerations: 1,
      decelerations: 1,
    });
  });
});
