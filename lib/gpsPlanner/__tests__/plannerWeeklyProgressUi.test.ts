import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function readRel(rel: string) {
  return readFile(path.join(process.cwd(), rel), "utf8");
}

describe("Planning Weekly Progress Phase 4B UI", () => {
  it("is collapsed by default and only loads progress when expanded", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/WeeklyPlannerView.tsx"
    );
    expect(view).toContain(
      "const [weeklyProgressExpanded, setWeeklyProgressExpanded] = useState(false)"
    );
    expect(view).toContain('aria-expanded={weeklyProgressExpanded}');
    expect(view).toContain(
      '{weeklyProgressExpanded ? "Collapse" : "Expand"}'
    );
    expect(view).toContain("{weeklyProgressExpanded ? (");

    const effect = view.slice(
      view.indexOf("if (!weeklyProgressExpanded)"),
      view.indexOf("function togglePlayer")
    );
    expect(effect).toContain("setProgress(null)");
    expect(effect).toContain("return;");
    expect(effect).toContain("void loadProgress()");
    expect(effect).toContain("focusedPlayerId && weeklyTarget");
    expect(effect).toContain("weeklyProgressExpanded");
    expect(effect).toContain("throughDate");
  });

  it("reuses focused-player progress action and keeps diagnostics + Refresh", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/WeeklyPlannerView.tsx"
    );
    expect(view).toContain("const loadProgress = useCallback");
    expect(view).toContain("getPlannerWeeklyProgressAction");
    expect(view).toContain("playerId: focusedPlayerId");
    expect(view).not.toContain("getPlannerWeeklyReviewProgressAction");

    expect(view).toContain("Refresh progress");
    expect(view).toContain("onClick={() => void loadProgress()}");
    expect(view).toContain("CompletenessBanner");
    expect(view).toContain("formatProgressDayStatus");
    expect(view).toContain("Has daily target");
    expect(view).toContain("progress.days.map");
  });

  it("does not change Review Weekly, Daily Distribution, Weekly Target, or Daily Plan", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/WeeklyPlannerView.tsx"
    );
    const review = await readRel(
      "app/(app)/admin/planner/PlannerReviewView.tsx"
    );
    const actions = await readRel("app/actions/gpsPlanner.ts");

    expect(view).toContain("Save Daily Distribution");
    expect(view).toContain("Apply this day only");
    expect(view).toContain("Save Weekly Targets");
    expect(view).toContain("Save focused player only");
    expect(view).toContain("openDailyPlan");
    expect(view).toContain("Apply this day only");

    expect(review).toContain("getPlannerWeeklyReviewProgressAction");
    expect(review).not.toContain("getPlannerWeeklyProgressAction");
    expect(review).not.toContain("weeklyProgressExpanded");
    expect(actions).toContain("export async function getPlannerWeeklyProgressAction");
    expect(actions).toContain("export async function getPlannerWeeklyReviewProgressAction");
  });
});
