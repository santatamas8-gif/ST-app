import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function readRel(rel: string) {
  return readFile(path.join(process.cwd(), rel), "utf8");
}

describe("Daily Plan Phase 3 UI", () => {
  it("uses one common Training-day control and the existing print route", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/WeeklyPlannerView.tsx"
    );
    expect(view).toContain("function openDailyPlan");
    expect(view).toContain("onClick={openDailyPlan}");
    expect(view).toContain("/admin/planner/daily-plan?");
    expect(view).toContain("weekDayId: dailyPlanWeekDayId");
    expect(view).toContain("playerIds: selectedPlayerIds.join(\",\")");
    expect(view).toContain("days.map((d) => (");
    expect(view).toContain("{d.mdTag} · {d.date}");
    expect(view).toContain("setDailyPlanWeekDayId");
    expect(view).toContain("return days[0]?.id ?? \"\"");
    expect(view).toContain("if (prev && days.some((d) => d.id === prev)) return prev");
    expect(view.match(/onClick=\{openDailyPlan\}/g)?.length).toBe(1);
    expect(view.match(/\/admin\/planner\/daily-plan\?/g)?.length).toBe(1);
    expect(view).not.toContain("weekDayId: item.matchId");
    expect(view).not.toContain("playerIds: focusedPlayerId");
    const openFn = view.slice(
      view.indexOf("function openDailyPlan"),
      view.indexOf("function applyDailyToSelected")
    );
    expect(openFn).toContain("playerIds: selectedPlayerIds.join(\",\")");
    expect(openFn).not.toContain("dailyPctInputs");
    expect(openFn).not.toContain("focusedPlayerId");
    expect(openFn).not.toContain("combinedWeek");
  });

  it("removes per-card Daily Plan buttons and keeps Phase 1 Daily Distribution", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/WeeklyPlannerView.tsx"
    );
    expect(view).not.toContain(">\n                          Daily Plan\n");
    expect(view).toContain("weekDayId: dailyPlanWeekDayId");
    expect(view).toContain("Save Daily Distribution");
    expect(view).toContain("applyDailyDistributionToPlayers");
    expect(view).toContain("Apply this day only");
    expect(view).toContain("applyDailyToSelected(day.id)");
    expect(view).toContain("Select at least one player");
    expect(view).toContain(
      "selectedPlayerIds.length === 0 || !dailyPlanWeekDayId"
    );
  });

  it("print page still reads persisted Daily Plan, not form inputs", async () => {
    const page = await readRel(
      "app/(app)/admin/planner/daily-plan/page.tsx"
    );
    const actions = await readRel("app/actions/gpsPlanner.ts");
    expect(page).toContain("getDailyPlanForPrintAction");
    expect(page).toContain("weekDayId");
    expect(page).toContain("playerIds");
    expect(page).not.toContain("dailyPctInputs");
    expect(actions).toContain("getDailyPlanForPrint");
  });
});
