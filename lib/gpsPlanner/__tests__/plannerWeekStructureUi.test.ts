import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function readRel(rel: string) {
  return readFile(path.join(process.cwd(), rel), "utf8");
}

describe("combined Week structure UI — Match is display-only", () => {
  it("6–10: Daily allocation and Daily Plan stay on Training rows only", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/WeeklyPlannerView.tsx"
    );
    expect(view).toContain("buildCombinedWeekStructure");
    expect(view).toContain("formatCombinedWeekKind");
    expect(view).toContain('type === "match"');
    expect(view).toContain("combinedWeek.map");
    expect(view).toContain("sm:hidden");
    expect(view).toContain("hidden overflow-x-auto sm:block");
    expect(view).toMatch(/for \(const day of days\)/);
    expect(view).toContain("sumPercentageMetrics(rows)");
    expect(view).not.toContain("for (const item of combinedWeek)");
    expect(view).not.toContain("saveDaily(item");
    expect(view).not.toContain("applyDailyToSelected(item");
    expect(view).not.toContain("weekDayId: item.matchId");
    expect(view).not.toContain("M1+1");
    expect(view).not.toContain("M2-3");
    expect(view).not.toContain("day_type");
    expect(view).not.toContain("saveDaily(day.id)");
    expect(view).not.toContain("onClick={() => saveDaily(day.id)}");
    expect(view).toContain("saveDailyDistribution");
    expect(view).toContain("applyDailyDistributionToPlayers");
    expect(view).toContain("Apply this day only");
    expect(view).toContain("applyDailyToSelected(day.id)");
    expect(view).toContain('weekDayId: day.id');
  });

  it("11–12: Daily Review selector and Weekly Review stay Training-only", async () => {
    const review = await readRel(
      "app/(app)/admin/planner/PlannerReviewView.tsx"
    );
    expect(review).toContain("{days.map((d) => (");
    expect(review).toContain("getPlannerWeeklyReviewProgressAction");
    expect(review).toContain("getPlannerDailyReviewAnalysisAction");
    expect(review).not.toContain("buildCombinedWeekStructure");
    expect(review).not.toContain("officialMatches.map");
    expect(review).not.toContain("Match 1");
    expect(review).not.toContain("Match 2");
  });
});
