import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function readRel(rel: string) {
  return readFile(path.join(process.cwd(), rel), "utf8");
}

describe("Persistent Week Squad WS-E UI", () => {
  it("loads persisted squad into saved and working selection", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/WeeklyPlannerView.tsx"
    );
    expect(view).toContain("const [savedSquadPlayerIds, setSavedSquadPlayerIds]");
    expect(view).toContain("const [selectedPlayerIds, setSelectedPlayerIds]");
    expect(view).toContain("listPlannerWeekPlayersAction(id)");
    expect(view).toContain("setSavedSquadPlayerIds(ids)");
    expect(view).toContain("setSelectedPlayerIds(copyPlayerIds(ids))");
    expect(view).toContain("setSquadLoadState(\"ready\")");
    expect(view).toContain("setFocusedPlayerId(firstFocusedFromPlayers");
    expect(view).not.toContain("listPlannerWeeklyTargetsAction");
    expect(view).not.toContain("planner_weekly_targets");
  });

  it("clears previous week selection and ignores stale week-scoped responses", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/WeeklyPlannerView.tsx"
    );
    const loadFn = view.slice(
      view.indexOf("const loadWeekScoped"),
      view.indexOf("useEffect(() => {\n    onWeekIdChange")
    );
    expect(loadFn).toContain("const requestId = ++weekScopedRequestId.current");
    expect(loadFn).toContain("lastSquadWeekIdRef.current !== id");
    expect(loadFn).toContain("if (weekScopedRequestId.current !== requestId) return");
    expect(loadFn).toContain("setSelectedPlayerIds([])");
    expect(loadFn).toContain("setSavedSquadPlayerIds([])");
    expect(loadFn).toContain("setFocusedPlayerId(null)");
    expect(loadFn).toContain("setSquadLoadState(id ? \"loading\" : \"idle\")");
    expect(loadFn).toContain("listPlannerWeekPlayersAction(id)");
  });

  it("does not auto-save membership from working-selection controls", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/WeeklyPlannerView.tsx"
    );
    const toggleFn = view.slice(
      view.indexOf("function togglePlayer"),
      view.indexOf("function selectGroupMembers")
    );
    const selectAllFn = view.slice(
      view.indexOf("function selectAllPlayers"),
      view.indexOf("function clearSelectedPlayers")
    );
    const clearFn = view.slice(
      view.indexOf("function clearSelectedPlayers"),
      view.indexOf("function resetToSavedSquad")
    );
    const groupFn = view.slice(
      view.indexOf("function selectGroupMembers"),
      view.indexOf("function selectAllPlayers")
    );
    expect(toggleFn).not.toContain("savePlannerWeekPlayersAction");
    expect(selectAllFn).not.toContain("savePlannerWeekPlayersAction");
    expect(clearFn).not.toContain("savePlannerWeekPlayersAction");
    expect(groupFn).not.toContain("savePlannerWeekPlayersAction");
    expect(selectAllFn).toContain("setSelectedPlayerIds(players.map((p) => p.id))");
    expect(clearFn).toContain("setSelectedPlayerIds([])");
    expect(groupFn).toContain("setSelectedPlayerIds(ids)");
  });

  it("derives dirty state from set equality and exposes reset/save", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/WeeklyPlannerView.tsx"
    );
    expect(view).toContain("function squadSelectionDiff");
    expect(view).toContain("addedCount");
    expect(view).toContain("removedCount");
    expect(view).toContain("changed: addedCount > 0 || removedCount > 0");
    expect(view).toContain("Saved squad ·");
    expect(view).toContain("unsaved");
    expect(view).toContain("changes · +");
    expect(view).toContain("Reset to saved squad");
    expect(view).toContain("Save Squad");
    const resetFn = view.slice(
      view.indexOf("function resetToSavedSquad"),
      view.indexOf("function retryLoadSavedSquad")
    );
    expect(resetFn).toContain("copyPlayerIds(savedSquadPlayerIds)");
    expect(resetFn).not.toContain("savePlannerWeekPlayersAction");
    expect(resetFn).not.toContain("listPlannerWeekPlayersAction");
  });

  it("Save Squad uses the locked action and returned savedPlayerIds", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/WeeklyPlannerView.tsx"
    );
    const saveFn = view.slice(
      view.indexOf("async function saveWeekSquad"),
      view.indexOf("function openCreateWeek")
    );
    expect(saveFn).toContain("savePlannerWeekPlayersAction");
    expect(saveFn).toContain("selectedPlayerIds");
    expect(saveFn).toContain("weekId: weekAtSave");
    expect(saveFn).toContain("res.data.savedPlayerIds");
    expect(saveFn).toContain("setSavedSquadPlayerIds(savedIds)");
    expect(saveFn).toContain("setSelectedPlayerIds(copyPlayerIds(savedIds))");
    expect(saveFn).toContain("Squad saved ·");
    expect(saveFn).toContain("if (!res.ok)");
    expect(saveFn).not.toContain("setSelectedPlayerIds([])");
    expect(saveFn).not.toContain("createPlannerWeeklyTarget");
    expect(saveFn).not.toContain("deletePlannerWeeklyTarget");
    expect(saveFn).not.toContain("createPlannerDailyTarget");
    expect(saveFn).not.toContain("deletePlannerDailyTarget");
    expect(saveFn).not.toContain("getPlannerMatchBestSnapshot");
    expect(saveFn).not.toContain("getMatchBestGps");
    expect(saveFn).not.toContain("getTrainingActualGps");
    expect(saveFn).not.toContain("getMatchActualGps");
    expect(saveFn).not.toContain("executeQuery");
    expect(saveFn).not.toContain("addedPlayerIds");
    expect(view).toContain("disabled={!canSaveSquad}");
    expect(view).toContain("squadLoadState === \"error\"");
    expect(view).toContain("Save Squad is disabled until it");
  });

  it("protects selection during save and ignores late save after week switch", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/WeeklyPlannerView.tsx"
    );
    expect(view).toContain(
      "const selectionLocked = squadSaving || squadLoadState === \"loading\""
    );
    expect(view).toContain("disabled={selectionLocked}");
    expect(view).toContain("if (selectionLocked) return");
    const saveFn = view.slice(
      view.indexOf("async function saveWeekSquad"),
      view.indexOf("function openCreateWeek")
    );
    expect(saveFn).toContain("squadSaveGenRef.current !== saveGen");
    expect(saveFn).toContain("weekIdRef.current !== weekAtSave");
  });

  it("keeps Weekly, Daily, Apply this day, and Daily Plan on working selection", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/WeeklyPlannerView.tsx"
    );
    expect(view).toContain("playerIds: selectedPlayerIds");
    expect(view).toContain("playerIds: selectedPlayerIds.join(\",\")");
    expect(view).toContain("applyWeeklyTargetsToPlayers");
    expect(view).toContain("applyDailyDistributionToPlayers");
    expect(view).toContain("applyDailyToSelected(day.id)");
    expect(view).toContain("function openDailyPlan");
    expect(view).not.toContain("playerIds: savedSquadPlayerIds");
    expect(view).not.toContain("Apply existing plan");
    expect(view).not.toContain("Apply Existing Plan");
  });
});
