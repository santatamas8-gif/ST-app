import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getAppUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getAppUser: (...args: unknown[]) => getAppUser(...args),
  isAdmin: (role: string) => role === "admin",
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: vi.fn() }),
}));

const getPlannerWeeklyTarget = vi.fn();
const createPlannerWeeklyTarget = vi.fn();
const updatePlannerWeeklyTarget = vi.fn();

vi.mock("@/lib/gpsPlanner/weeklyTargets.server", () => ({
  getPlannerWeeklyTarget: (...args: unknown[]) => getPlannerWeeklyTarget(...args),
  createPlannerWeeklyTarget: (...args: unknown[]) =>
    createPlannerWeeklyTarget(...args),
  updatePlannerWeeklyTarget: (...args: unknown[]) =>
    updatePlannerWeeklyTarget(...args),
  deletePlannerWeeklyTarget: vi.fn(),
  listPlannerWeeklyTargets: vi.fn(),
  getPlannerMatchBestSnapshot: vi.fn(),
}));

vi.mock("@/lib/gpsPlanner/weeks.server", () => ({
  listPlannerWeeks: vi.fn(),
  createPlannerWeek: vi.fn(),
  updatePlannerWeek: vi.fn(),
  deletePlannerWeek: vi.fn(),
}));

vi.mock("@/lib/gpsPlanner/weekDays.server", () => ({
  listPlannerWeekDays: vi.fn(),
  createPlannerWeekDay: vi.fn(),
  updatePlannerWeekDay: vi.fn(),
  deletePlannerWeekDay: vi.fn(),
}));

vi.mock("@/lib/gpsPlanner/groups.server", () => ({
  listPlannerGroups: vi.fn(),
  createPlannerGroup: vi.fn(),
  updatePlannerGroup: vi.fn(),
  deletePlannerGroup: vi.fn(),
  listPlannerGroupMembers: vi.fn(),
  addPlannerGroupMember: vi.fn(),
  removePlannerGroupMember: vi.fn(),
}));

vi.mock("@/lib/gpsPlanner/dailyTargets.server", () => ({
  getPlannerDailyTarget: vi.fn(),
  listPlannerDailyTargetsForDay: vi.fn(),
  listPlannerDailyTargetsForPlayerWeek: vi.fn(),
  createPlannerDailyTarget: vi.fn(),
  updatePlannerDailyTarget: vi.fn(),
  deletePlannerDailyTarget: vi.fn(),
}));

vi.mock("@/lib/gpsPlanner/progress.server", () => ({
  getPlannerWeeklyProgress: vi.fn(),
  getPlannerWeeklyReviewProgress: vi.fn(),
  getPlannerDailyAnalysis: vi.fn(),
  getPlannerDailyReviewAnalysis: vi.fn(),
}));
vi.mock("@/lib/gpsPlanner/dailyPlan.server", () => ({
  getDailyPlanForPrint: vi.fn(),
}));
vi.mock("@/lib/gpsPlanner/weekMatches.server", () => ({
  getPlannerWeekOfficialMatch: vi.fn(),
  setPlannerWeekOfficialMatch: vi.fn(),
  deletePlannerWeekOfficialMatch: vi.fn(),
}));
vi.mock("@/lib/gpsPlanner/totalLoad.server", () => ({
  getPlannerTotalLoad: vi.fn(),
}));
vi.mock("@/lib/gpsPlanner/matchCandidates.server", () => ({
  listPlannerMatchCandidates: vi.fn(),
}));

vi.mock("@/lib/gpsPlanner/playerMappings.server", () => ({
  listPlayerMappings: vi.fn(),
  listPowerBiPlayerCandidates: vi.fn(),
  createPlayerMapping: vi.fn(),
  updatePlayerMapping: vi.fn(),
  deletePlayerMapping: vi.fn(),
  getPlayerMapping: vi.fn(),
}));

import { applyWeeklyTargetsToPlayers } from "@/app/actions/gpsPlanner";

const ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "a@t.com",
  role: "admin" as const,
};

const WEEK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const P1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const P2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("applyWeeklyTargetsToPlayers", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    getPlannerWeeklyTarget.mockReset();
    createPlannerWeeklyTarget.mockReset();
    updatePlannerWeeklyTarget.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("creates when missing and updates when present", async () => {
    getPlannerWeeklyTarget
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({
        ok: true,
        data: { weekId: WEEK_ID, playerId: P2 },
      });
    createPlannerWeeklyTarget.mockResolvedValue({
      ok: true,
      data: { weekId: WEEK_ID, playerId: P1 },
    });
    updatePlannerWeeklyTarget.mockResolvedValue({
      ok: true,
      data: { weekId: WEEK_ID, playerId: P2 },
    });

    const result = await applyWeeklyTargetsToPlayers({
      weekId: WEEK_ID,
      playerIds: [P1, P2],
      tdPct: 200,
      hsrPct: 120,
      sprintPct: 100,
      accPct: 300,
      decPct: 300,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([
      { playerId: P1, status: "created" },
      { playerId: P2, status: "updated" },
    ]);
    expect(createPlannerWeeklyTarget).toHaveBeenCalledTimes(1);
    expect(updatePlannerWeeklyTarget).toHaveBeenCalledTimes(1);
  });

  it("records failed outcomes without inventing formulas", async () => {
    getPlannerWeeklyTarget.mockResolvedValue({
      ok: false,
      error: { code: "mapping_not_found", message: "No mapping." },
    });

    const result = await applyWeeklyTargetsToPlayers({
      weekId: WEEK_ID,
      playerIds: [P1],
      tdPct: 200,
      hsrPct: 120,
      sprintPct: 100,
      accPct: 300,
      decPct: 300,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]).toEqual({
      playerId: P1,
      status: "failed",
      message:
        "Power BI mapping not set — map the player before creating a Weekly Target",
    });
    expect(createPlannerWeeklyTarget).not.toHaveBeenCalled();
  });

  it("rejects non-admin", async () => {
    getAppUser.mockResolvedValue({
      id: ADMIN.id,
      email: "s@t.com",
      role: "staff",
    });

    const result = await applyWeeklyTargetsToPlayers({
      weekId: WEEK_ID,
      playerIds: [P1],
      tdPct: 200,
      hsrPct: 120,
      sprintPct: 100,
      accPct: 300,
      decPct: 300,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unauthorized");
  });
});
