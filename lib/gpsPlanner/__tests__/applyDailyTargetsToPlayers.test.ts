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

const getMatchBestGps = vi.fn();
const getTrainingActualGps = vi.fn();
vi.mock("@/lib/powerbi/queries/matchBest", () => ({
  getMatchBestGps: (...args: unknown[]) => getMatchBestGps(...args),
}));
vi.mock("@/lib/powerbi/queries/trainingActual", () => ({
  getTrainingActualGps: (...args: unknown[]) => getTrainingActualGps(...args),
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
vi.mock("@/lib/gpsPlanner/weeklyTargets.server", () => ({
  getPlannerWeeklyTarget: vi.fn(),
  createPlannerWeeklyTarget: vi.fn(),
  updatePlannerWeeklyTarget: vi.fn(),
  deletePlannerWeeklyTarget: vi.fn(),
  listPlannerWeeklyTargets: vi.fn(),
  getPlannerMatchBestSnapshot: vi.fn(),
}));

const getPlannerDailyTarget = vi.fn();
const createPlannerDailyTarget = vi.fn();
const updatePlannerDailyTarget = vi.fn();

vi.mock("@/lib/gpsPlanner/dailyTargets.server", () => ({
  getPlannerDailyTarget: (...args: unknown[]) => getPlannerDailyTarget(...args),
  listPlannerDailyTargetsForDay: vi.fn(),
  listPlannerDailyTargetsForPlayerWeek: vi.fn(),
  createPlannerDailyTarget: (...args: unknown[]) =>
    createPlannerDailyTarget(...args),
  updatePlannerDailyTarget: (...args: unknown[]) =>
    updatePlannerDailyTarget(...args),
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
  getPlannerWeekOfficialMatches: vi.fn(),
  setPlannerWeekOfficialMatch: vi.fn(),
  deletePlannerWeekOfficialMatch: vi.fn(),
}));
vi.mock("@/lib/gpsPlanner/totalLoad.server", () => ({
  getPlannerTotalLoad: vi.fn(),
}));
vi.mock("@/lib/gpsPlanner/matchCandidates.server", () => ({
  listPlannerMatchCandidates: vi.fn(),
}));

const listPlayerMappings = vi.fn();
const listPowerBiPlayerCandidates = vi.fn();
vi.mock("@/lib/gpsPlanner/playerMappings.server", () => ({
  listPlayerMappings: (...args: unknown[]) => listPlayerMappings(...args),
  listPowerBiPlayerCandidates: (...args: unknown[]) =>
    listPowerBiPlayerCandidates(...args),
  createPlayerMapping: vi.fn(),
  updatePlayerMapping: vi.fn(),
  deletePlayerMapping: vi.fn(),
  getPlayerMapping: vi.fn(),
}));

import { applyDailyTargetToPlayers } from "@/app/actions/gpsPlanner";
import { plannerErrorMessage } from "@/lib/gpsPlanner/uiDisplay";
import { PLANNER_NAV_ITEM } from "@/lib/gpsPlanner/nav";

const ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "a@t.com",
  role: "admin" as const,
};

const DAY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const P1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const P2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const P3 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const PCT = {
  tdPct: 40,
  hsrPct: 50,
  sprintPct: 30,
  accPct: 45,
  decPct: 45,
};

describe("applyDailyTargetToPlayers", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    getPlannerDailyTarget.mockReset();
    createPlannerDailyTarget.mockReset();
    updatePlannerDailyTarget.mockReset();
    getMatchBestGps.mockReset();
    getTrainingActualGps.mockReset();
    listPlayerMappings.mockReset();
    listPowerBiPlayerCandidates.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("creates missing and updates existing with the same percentages", async () => {
    getPlannerDailyTarget
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({
        ok: true,
        data: { weekDayId: DAY_ID, playerId: P2 },
      });
    createPlannerDailyTarget.mockResolvedValue({
      ok: true,
      data: { weekDayId: DAY_ID, playerId: P1 },
    });
    updatePlannerDailyTarget.mockResolvedValue({
      ok: true,
      data: { weekDayId: DAY_ID, playerId: P2 },
    });

    const result = await applyDailyTargetToPlayers({
      weekDayId: DAY_ID,
      playerIds: [P1, P2],
      ...PCT,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([
      { playerId: P1, status: "created" },
      { playerId: P2, status: "updated" },
    ]);
    expect(createPlannerDailyTarget).toHaveBeenCalledTimes(1);
    expect(createPlannerDailyTarget).toHaveBeenCalledWith({
      weekDayId: DAY_ID,
      playerId: P1,
      ...PCT,
    });
    expect(updatePlannerDailyTarget).toHaveBeenCalledTimes(1);
    expect(updatePlannerDailyTarget).toHaveBeenCalledWith({
      weekDayId: DAY_ID,
      playerId: P2,
      ...PCT,
    });
    // Same % to each player — no shared absolute target calculation in orchestrator.
    expect(createPlannerDailyTarget.mock.calls[0][0]).not.toHaveProperty(
      "totalDistance"
    );
    expect(updatePlannerDailyTarget.mock.calls[0][0]).not.toHaveProperty("hsr");
  });

  it("continues after one player failure (best-effort)", async () => {
    getPlannerDailyTarget
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({ ok: true, data: null });
    createPlannerDailyTarget
      .mockResolvedValueOnce({
        ok: false,
        error: {
          code: "weekly_target_not_found",
          message: "A weekly target is required before creating a daily target.",
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { weekDayId: DAY_ID, playerId: P2 },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { weekDayId: DAY_ID, playerId: P3 },
      });

    const result = await applyDailyTargetToPlayers({
      weekDayId: DAY_ID,
      playerIds: [P1, P2, P3],
      ...PCT,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([
      {
        playerId: P1,
        status: "failed",
        message: plannerErrorMessage("weekly_target_not_found"),
      },
      { playerId: P2, status: "created" },
      { playerId: P3, status: "created" },
    ]);
    expect(createPlannerDailyTarget).toHaveBeenCalledTimes(3);
  });

  it("surfaces Weekly Target missing as per-player failure", async () => {
    getPlannerDailyTarget.mockResolvedValue({ ok: true, data: null });
    createPlannerDailyTarget.mockResolvedValue({
      ok: false,
      error: {
        code: "weekly_target_not_found",
        message: "A weekly target is required before creating a daily target.",
      },
    });

    const result = await applyDailyTargetToPlayers({
      weekDayId: DAY_ID,
      playerIds: [P1],
      ...PCT,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0].status).toBe("failed");
    expect(result.data[0].message).toBe("Weekly Target not found");
  });

  it("does not call Power BI or mapping helpers", async () => {
    getPlannerDailyTarget.mockResolvedValue({ ok: true, data: null });
    createPlannerDailyTarget.mockResolvedValue({
      ok: true,
      data: { weekDayId: DAY_ID, playerId: P1 },
    });

    await applyDailyTargetToPlayers({
      weekDayId: DAY_ID,
      playerIds: [P1],
      ...PCT,
    });

    expect(getMatchBestGps).not.toHaveBeenCalled();
    expect(getTrainingActualGps).not.toHaveBeenCalled();
    expect(listPlayerMappings).not.toHaveBeenCalled();
    expect(listPowerBiPlayerCandidates).not.toHaveBeenCalled();
  });

  it("rejects Staff", async () => {
    getAppUser.mockResolvedValue({
      id: ADMIN.id,
      email: "s@t.com",
      role: "staff",
    });

    const result = await applyDailyTargetToPlayers({
      weekDayId: DAY_ID,
      playerIds: [P1],
      ...PCT,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unauthorized");
    expect(createPlannerDailyTarget).not.toHaveBeenCalled();
  });

  it("rejects Player", async () => {
    getAppUser.mockResolvedValue({
      id: ADMIN.id,
      email: "p@t.com",
      role: "player",
    });

    const result = await applyDailyTargetToPlayers({
      weekDayId: DAY_ID,
      playerIds: [P1],
      ...PCT,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unauthorized");
  });

  it("Planner nav remains admin-only", () => {
    expect(PLANNER_NAV_ITEM.roles).toEqual(["admin"]);
  });
});
