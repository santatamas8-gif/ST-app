import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function readView() {
  return readFile(
    path.join(process.cwd(), "app/(app)/admin/planner/WeeklyPlannerView.tsx"),
    "utf8"
  );
}

function saveFn(view: string) {
  return view.slice(
    view.indexOf("async function saveWeekSquad"),
    view.indexOf("function openCreateWeek")
  );
}

function applyFn(view: string) {
  return view.slice(
    view.indexOf("async function applyExistingPlan"),
    view.indexOf("function openEditWeek")
  );
}

function skipFn(view: string) {
  return view.slice(
    view.indexOf("function skipInheritanceOffer"),
    view.indexOf("async function applyExistingPlan")
  );
}

describe("Apply Existing Plan WS-F2 UI", () => {
  it("1–2. analyzes only after successful Save Squad with added players", async () => {
    const view = await readView();
    const save = saveFn(view);
    expect(save).toContain("savePlannerWeekPlayersAction");
    expect(save).toContain("addedPlayerIds.length === 0");
    expect(save).toContain("analyzePlannerWeekPlanInheritanceAction");
    expect(save.indexOf("savePlannerWeekPlayersAction")).toBeLessThan(
      save.indexOf("analyzePlannerWeekPlanInheritanceAction")
    );
    expect(save).toContain("if (!res.ok)");
    expect(save.indexOf("if (!res.ok)")).toBeLessThan(
      save.indexOf("analyzePlannerWeekPlanInheritanceAction")
    );
    expect(view).not.toMatch(
      /useEffect\([\s\S]{0,200}analyzePlannerWeekPlanInheritanceAction/
    );
  });

  it("3–6. panel only for eligible players with reusable plans", async () => {
    const view = await readView();
    const save = saveFn(view);
    expect(save).toContain("eligibleNewPlayerIds.length === 0");
    expect(save).toContain("reusablePlans.length === 0");
    expect(view).toContain("Apply existing plan?");
    expect(view).toContain("Choose existing plan");
    expect(view).toContain("{inheritanceOffer && (");
    expect(save).toContain("setInheritanceOffer");
    expect(save.indexOf("reusablePlans.length === 0")).toBeLessThan(
      save.lastIndexOf("setInheritanceOffer")
    );
    expect(save).toContain("eligibleNewPlayerIds");
  });

  it("7–8. Apply sends week id, eligible ids, and planKey only", async () => {
    const view = await readView();
    const apply = applyFn(view);
    expect(apply).toContain("applyPlannerExistingPlanAction");
    expect(apply).toContain("weekId: offer.weekId");
    expect(apply).toContain("targetPlayerIds: offer.eligiblePlayerIds");
    expect(apply).toContain("planKey: offer.selectedPlanKey");
    expect(apply).not.toContain("tdPct");
    expect(apply).not.toContain("weeklyPct");
    expect(apply).not.toContain("hsrPct");
    expect(apply).not.toContain("totalDistance");
  });

  it("9. Skip writes no targets or membership", async () => {
    const view = await readView();
    const skip = skipFn(view);
    expect(skip).toContain("setInheritanceOffer(null)");
    expect(skip).not.toContain("applyPlannerExistingPlanAction");
    expect(skip).not.toContain("savePlannerWeekPlayersAction");
    expect(skip).not.toContain("createPlannerWeeklyTarget");
    expect(skip).not.toContain("createPlannerDailyTarget");
  });

  it("10–12. success dismisses; failure keeps membership; partial shown", async () => {
    const view = await readView();
    const apply = applyFn(view);
    expect(apply).toContain("Plan applied to");
    expect(apply).toContain("setInheritanceOffer(null)");
    expect(apply).toContain("applied ·");
    expect(apply).toContain("failed");
    expect(apply).not.toContain("savePlannerWeekPlayersAction");
    expect(apply).not.toContain("setSavedSquadPlayerIds");
    expect(apply).not.toContain("setSelectedPlayerIds");
    expect(view).toContain("if (!res.ok)");
  });

  it("13–15. Save Squad stays independent; no auto Apply; no Power BI", async () => {
    const view = await readView();
    const save = saveFn(view);
    const apply = applyFn(view);
    expect(save).toContain("setSquadFlash(`Squad saved");
    expect(save).not.toContain("applyPlannerExistingPlanAction");
    expect(view).toContain("onClick={() => void applyExistingPlan()}");
    expect(view).toContain("Apply plan");
    expect(view).toContain("Apply selected plan");
    expect(view).toContain("Skip");
    expect(save).not.toContain("getMatchBestGps");
    expect(save).not.toContain("getTrainingActualGps");
    expect(apply).not.toContain("getMatchBestGps");
    expect(apply).not.toContain("executeQuery");
    expect(view).not.toContain("applyExistingPlan();");
    expect(view).toContain("flex flex-wrap gap-2");
  });
});
