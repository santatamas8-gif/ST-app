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
  createPlannerWeekOfficialMatch: vi.fn(),
  updatePlannerWeekOfficialMatchById: vi.fn(),
  deletePlannerWeekOfficialMatchById: vi.fn(),
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

import { applyDailyDistributionToPlayers, applyDailyTargetToPlayers } from "@/app/actions/gpsPlanner";
import { calculateDailyPlannedAbsolutes } from "@/lib/gpsPlanner/calculations";
import { plannerErrorMessage } from "@/lib/gpsPlanner/uiDisplay";
import { PLANNER_NAV_ITEM } from "@/lib/gpsPlanner/nav";
import { listPlannerWeekDays } from "@/lib/gpsPlanner/weekDays.server";

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

const WEEK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DAY_2 = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const MATCH_ID = "99999999-9999-4999-8999-999999999999";
const FROZEN_BEST = {
  tdBest: 11000,
  hsrBest: 800,
  sprintBest: 200,
  accBest: 40,
  decBest: 40,
};

describe("applyDailyDistributionToPlayers", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    getPlannerDailyTarget.mockReset();
    createPlannerDailyTarget.mockReset();
    updatePlannerDailyTarget.mockReset();
    vi.mocked(listPlannerWeekDays).mockReset();
    getAppUser.mockResolvedValue(ADMIN);
    vi.mocked(listPlannerWeekDays).mockResolvedValue({
      ok: true,
      data: [
        { id: DAY_ID, weekId: WEEK_ID },
        { id: DAY_2, weekId: WEEK_ID },
      ],
    } as never);
  });

  it("processes all Training days and skips Match ids", async () => {
    getPlannerDailyTarget.mockResolvedValue({ ok: true, data: null });
    createPlannerDailyTarget.mockImplementation(
      async (input: { weekDayId: string; playerId: string }) => ({
        ok: true,
        data: { weekDayId: input.weekDayId, playerId: input.playerId },
      })
    );

    const result = await applyDailyDistributionToPlayers({
      weekId: WEEK_ID,
      playerIds: [P1],
      days: [
        { weekDayId: DAY_ID, ...PCT },
        { weekDayId: DAY_2, ...PCT },
        { weekDayId: MATCH_ID, ...PCT },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(createPlannerDailyTarget).toHaveBeenCalledTimes(2);
    expect(createPlannerDailyTarget).toHaveBeenCalledWith({
      weekDayId: DAY_ID,
      playerId: P1,
      ...PCT,
    });
    expect(createPlannerDailyTarget).toHaveBeenCalledWith({
      weekDayId: DAY_2,
      playerId: P1,
      ...PCT,
    });
    expect(createPlannerDailyTarget.mock.calls.some((call) => call[0].weekDayId === MATCH_ID)).toBe(
      false
    );
    expect(result.data.skippedDays).toEqual([
      { weekDayId: MATCH_ID, reason: "Not a Training day for this week." },
    ]);
    expect(result.data.successCount).toBe(2);
    expect(result.data.failedCount).toBe(0);
  });

  it("updates the same (week_day_id, player_id) instead of duplicating", async () => {
    getPlannerDailyTarget.mockResolvedValue({
      ok: true,
      data: { weekDayId: DAY_ID, playerId: P1 },
    });
    updatePlannerDailyTarget.mockResolvedValue({
      ok: true,
      data: { weekDayId: DAY_ID, playerId: P1 },
    });

    const result = await applyDailyDistributionToPlayers({
      weekId: WEEK_ID,
      playerIds: [P1],
      days: [{ weekDayId: DAY_ID, ...PCT }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(updatePlannerDailyTarget).toHaveBeenCalledTimes(1);
    expect(createPlannerDailyTarget).not.toHaveBeenCalled();
    expect(result.data.assignments[0].status).toBe("updated");
  });

  it("missing Weekly Target fails that assignment but others continue", async () => {
    getPlannerDailyTarget.mockResolvedValue({ ok: true, data: null });
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
      });

    const result = await applyDailyDistributionToPlayers({
      weekId: WEEK_ID,
      playerIds: [P1, P2],
      days: [{ weekDayId: DAY_ID, ...PCT }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.failedCount).toBe(1);
    expect(result.data.successCount).toBe(1);
    expect(result.data.assignments[0]).toMatchObject({
      playerId: P1,
      status: "failed",
    });
    expect(result.data.assignments[1]).toEqual({
      playerId: P2,
      weekDayId: DAY_ID,
      status: "created",
    });
  });

  it("skips incomplete/invalid days and does not write zeros", async () => {
    getPlannerDailyTarget.mockResolvedValue({ ok: true, data: null });
    createPlannerDailyTarget.mockResolvedValue({
      ok: true,
      data: { weekDayId: DAY_2, playerId: P1 },
    });

    const result = await applyDailyDistributionToPlayers({
      weekId: WEEK_ID,
      playerIds: [P1],
      days: [
        {
          weekDayId: DAY_ID,
          tdPct: Number.NaN,
          hsrPct: PCT.hsrPct,
          sprintPct: PCT.sprintPct,
          accPct: PCT.accPct,
          decPct: PCT.decPct,
        },
        { weekDayId: DAY_2, ...PCT },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(createPlannerDailyTarget).toHaveBeenCalledTimes(1);
    expect(createPlannerDailyTarget).toHaveBeenCalledWith({
      weekDayId: DAY_2,
      playerId: P1,
      ...PCT,
    });
    expect(result.data.skippedDays).toEqual([
      { weekDayId: DAY_ID, reason: "Incomplete or invalid Daily %." },
    ]);
  });

  it("legacy Apply vs new batch: exact stored % and raw planned absolute parity", async () => {
    getPlannerDailyTarget
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({
        ok: true,
        data: { weekDayId: DAY_ID, playerId: P2 },
      })
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

    const apply = await applyDailyTargetToPlayers({
      weekDayId: DAY_ID,
      playerIds: [P1, P2],
      ...PCT,
    });
    expect(apply.ok).toBe(true);
    const applyCreate = structuredClone(createPlannerDailyTarget.mock.calls);
    const applyUpdate = structuredClone(updatePlannerDailyTarget.mock.calls);

    createPlannerDailyTarget.mockClear();
    updatePlannerDailyTarget.mockClear();

    const batch = await applyDailyDistributionToPlayers({
      weekId: WEEK_ID,
      playerIds: [P1, P2],
      days: [{ weekDayId: DAY_ID, ...PCT }],
    });
    expect(batch.ok).toBe(true);
    expect(createPlannerDailyTarget.mock.calls).toEqual(applyCreate);
    expect(updatePlannerDailyTarget.mock.calls).toEqual(applyUpdate);

    const storedPct = applyCreate[0][0];
    expect(storedPct).toMatchObject(PCT);
    expect(calculateDailyPlannedAbsolutes(FROZEN_BEST, PCT)).toEqual(
      calculateDailyPlannedAbsolutes(FROZEN_BEST, {
        tdPct: storedPct.tdPct,
        hsrPct: storedPct.hsrPct,
        sprintPct: storedPct.sprintPct,
        accPct: storedPct.accPct,
        decPct: storedPct.decPct,
      })
    );
  });
});
