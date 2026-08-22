import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function readRel(rel: string) {
  return readFile(path.join(process.cwd(), rel), "utf8");
}

describe("Total Load Review UI", () => {
  it("A: Review tabs are Weekly | Daily | Total Load", async () => {
    const review = await readRel(
      "app/(app)/admin/planner/PlannerReviewView.tsx"
    );
    expect(review).toContain('export type ReviewTab = "weekly" | "daily" | "total_load"');
    expect(review).toContain("Weekly");
    expect(review).toContain("Daily");
    expect(review).toContain("Total Load");
    expect(review).toContain('onTabChange("total_load")');
    expect(review).toContain("PlannerTotalLoadView");
  });

  it("B: Weekly Review table, compliance, through-date, and print remain", async () => {
    const review = await readRel(
      "app/(app)/admin/planner/PlannerReviewView.tsx"
    );
    expect(review).toContain("WeeklyReviewTable");
    expect(review).toContain('const WEEKLY_SUB_COLS = ["Actual", "Planned", "Target"] as const');
    expect(review).toContain("weeklyComplianceTone");
    expect(review).toContain("Through date");
    expect(review).toContain("canPrintWeekly");
    expect(review).toContain('tab === "weekly"');
    expect(review).toContain("getPlannerWeeklyReviewProgressAction");
  });

  it("C: Daily Review table and compliance remain", async () => {
    const review = await readRel(
      "app/(app)/admin/planner/PlannerReviewView.tsx"
    );
    expect(review).toContain("DailyReviewTable");
    expect(review).toContain('const DAILY_SUB_COLS = ["Actual", "Planned", "Difference"] as const');
    expect(review).toContain("dailyComplianceTone");
    expect(review).toContain("getPlannerDailyReviewAnalysisAction");
    expect(review).toContain("Week day");
  });

  it("D-S: Total Load view consumes composer; Match identity is read-only", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/PlannerTotalLoadView.tsx"
    );
    expect(view).toContain("getPlannerTotalLoadAction");
    expect(view).toContain("Configured Matches");
    expect(view).not.toContain("setPlannerWeekOfficialMatchAction");
    expect(view).not.toContain("deletePlannerWeekOfficialMatchAction");
    expect(view).not.toContain("listPlannerMatchCandidatesAction");
    expect(view).not.toContain("Change match");
    expect(view).not.toContain("Clear match");
    expect(view).not.toContain("Save official match");
    expect(view).toContain("No Weekly Targets saved for this week.");
    expect(view).toContain("formatWeeklyPlanSharedPct");
    expect(view).toContain("result.topValues");
    expect(view).toContain('title: "TD"');
    expect(view).toContain('title: "HSR"');
    expect(view).toContain('title: "Sprint"');
    expect(view).toContain('title: "Acc"');
    expect(view).toContain('title: "Dec"');
    expect(view).not.toContain("Most TD");
    expect(view).toContain("Match Time");
    expect(view).toContain("{m.label}");
    expect(view).toContain("{m.label} %");
    expect(view).toContain("({m.unit})");
    expect(view).toContain("toggleTotalSort");
    expect(view).toContain("sortByMost");
    expect(view).toContain("sortTotalLoadRowsByTotal");
    expect(view).toContain("displayRows.map");
    expect(view).toContain("formatMatchTimeMinutes");
    expect(view).toContain("formatMatchDurationSeconds");
    expect(view).not.toContain("formatTotalLoadQualityBadge");
    expect(view).not.toContain("QualityBadge");
    expect(view).toContain("formatTotalLoadMetricBreakdown");
    expect(view).toContain("totalLoadCellValue");
    expect(view).not.toContain("computeTotalLoadTopValues");
    expect(view).not.toContain("weeklyComplianceTone");
    expect(view).not.toContain("dailyComplianceTone");
    expect(view).not.toContain("reviewCompliance");
    expect(view).not.toContain("bg-emerald-500");
    expect(view).not.toContain("bg-amber-500");
    expect(view).not.toContain("Tempo");
    expect(view).not.toContain("To Target");
    expect(view).not.toContain("window.print");
    expect(view).not.toContain("getMatchActualGpsBatch");
    expect(view).not.toContain("composeTotalLoadResult");
    const display = await readRel("lib/gpsPlanner/totalLoadDisplay.ts");
    expect(display).toContain('"Partial"');
    expect(display).toContain('"Data issue"');
    expect(display).toContain("Training: ${training} (Partial)");
    expect(display).toContain("GPS: Available");
    expect(display).toContain("GPS: Match data pending");
  });

  it("O/T: Top Values come from composer; no Total Load compliance colors", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/PlannerTotalLoadView.tsx"
    );
    expect(view).toContain("value={result.topValues[card.key]}");
    expect(view).not.toContain("reviewComplianceToneClass");
    const review = await readRel(
      "app/(app)/admin/planner/PlannerReviewView.tsx"
    );
    expect(review).toContain("PlannerTotalLoadView");
    expect(review).toContain("WeeklyReviewTable");
    expect(review).toContain("DailyReviewTable");
  });

  it("does not add Total Load print or change Daily Plan", async () => {
    const dailyPlan = await readRel(
      "app/(app)/admin/planner/daily-plan/page.tsx"
    );
    expect(dailyPlan).not.toContain("PlannerTotalLoadView");
    expect(dailyPlan).not.toContain("getPlannerTotalLoad");
    const view = await readRel(
      "app/(app)/admin/planner/PlannerTotalLoadView.tsx"
    );
    expect(view).toContain("no-print");
  });
});
