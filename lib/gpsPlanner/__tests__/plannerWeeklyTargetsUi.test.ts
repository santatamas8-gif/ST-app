import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function readRel(rel: string) {
  return readFile(path.join(process.cwd(), rel), "utf8");
}

describe("Weekly Target Phase 2B UI", () => {
  it("primary save uses selected players and typed weekly % via existing Apply", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/WeeklyPlannerView.tsx"
    );
    expect(view).toContain("Save Weekly Targets");
    expect(view).toContain("onClick={applyToSelected}");
    expect(view).toContain("applyWeeklyTargetsToPlayers");
    expect(view).toContain("playerIds: selectedPlayerIds");
    expect(view).toContain("parsePctInputs(weeklyPctInputs)");
    expect(view).toContain("Select at least one player");
    expect(view).toContain(
      "Focused player is not in the selected save group."
    );
    expect(view).not.toContain("Apply to {selectedPlayerIds.length} selected");
    expect(view).not.toContain("[...selectedPlayerIds");
    expect(view).not.toContain("selectedPlayerIds.concat");
    expect(view).not.toContain(
      "playerIds: [...selectedPlayerIds, focusedPlayerId]"
    );
  });

  it("focused-only Save remains secondary and uses existing create/update", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/WeeklyPlannerView.tsx"
    );
    expect(view).toContain("Save focused player only");
    expect(view).toContain("onClick={saveWeeklyForFocused}");
    expect(view).toContain("createPlannerWeeklyTargetAction");
    expect(view).toContain("updatePlannerWeeklyTargetAction");
    expect(view).toContain("playerId: focusedPlayerId");
    expect(view).toContain("askDeleteWeekly");
    expect(view).not.toContain(">\n                  Save Weekly\n");
  });

  it("Daily Distribution Phase 1 labels and handlers stay unchanged", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/WeeklyPlannerView.tsx"
    );
    expect(view).toContain("Save Daily Distribution");
    expect(view).toContain("applyDailyDistributionToPlayers");
    expect(view).toContain("Apply this day only");
    expect(view).toContain("applyDailyToSelected(day.id)");
    expect(view).toContain("saveDailyDistribution");
    expect(view).not.toContain("onClick={() => saveDaily(day.id)}");
    expect(view).not.toContain("selectedPlayerIdsByDay");
  });

  it("backend still uses the existing Apply orchestrator only", async () => {
    const actions = await readRel("app/actions/gpsPlanner.ts");
    expect(actions).toContain("export async function applyWeeklyTargetsToPlayers");
    expect(actions).toContain("createPlannerWeeklyTarget");
    expect(actions).toContain("updatePlannerWeeklyTarget");
    expect(actions).toContain("getPlannerWeeklyTarget");
    expect(actions).not.toContain("applyWeeklyTargetsToPlayersV2");
    expect(actions).not.toContain("saveWeeklyTargetsToPlayers");
  });
});
