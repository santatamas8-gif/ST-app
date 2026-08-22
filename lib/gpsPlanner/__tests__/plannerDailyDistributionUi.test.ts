import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function readRel(rel: string) {
  return readFile(path.join(process.cwd(), rel), "utf8");
}

describe("Daily Distribution Phase 1 UI", () => {
  it("primary save is week-level; per-day Apply remains override; Save Daily gone", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/WeeklyPlannerView.tsx"
    );
    expect(view).toContain("Save Daily Distribution");
    expect(view).toContain("applyDailyDistributionToPlayers");
    expect(view).toContain("for (const day of days)");
    expect(view).toContain("Apply this day only");
    expect(view).toContain("applyDailyToSelected(day.id)");
    expect(view).not.toContain("onClick={() => saveDaily(day.id)}");
    expect(view).not.toContain("saveDaily(");
    expect(view).not.toContain("selectedPlayerIdsByDay");
    expect(view).toContain("sumPercentageMetrics(rows)");
    expect(view).not.toContain("for (const item of combinedWeek)");
  });

  it("distribution action reuses create/update and does not touch Remaining math", async () => {
    const actions = await readRel("app/actions/gpsPlanner.ts");
    expect(actions).toContain("applyDailyDistributionToPlayers");
    expect(actions).toContain("applyDailyPctToSelectedPlayers");
    expect(actions).toContain("createPlannerDailyTarget");
    expect(actions).toContain("updatePlannerDailyTarget");
    expect(actions).toContain("listPlannerWeekDays");
    expect(actions).not.toContain("remainingToAllocate");
    expect(actions).not.toContain("calculateDailyPlannedAbsolutes");
  });
});
