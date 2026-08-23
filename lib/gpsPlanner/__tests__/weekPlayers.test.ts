import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getAppUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getAppUser: (...args: unknown[]) => getAppUser(...args),
  isAdmin: (role: string) => role === "admin",
}));

const fromMock = vi.fn();
const rpcMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/powerbi/queries/playerNames.server", () => ({
  getPowerBiPlayerCandidates: vi.fn(() => {
    throw new Error("Power BI must not be called for week squad");
  }),
}));
vi.mock("@/lib/powerbi/queries/matchBest.server", () => ({
  getMatchBestGps: vi.fn(() => {
    throw new Error("Power BI must not be called for week squad");
  }),
}));
vi.mock("@/lib/powerbi/queries/trainingActual.server", () => ({
  getTrainingActualGps: vi.fn(() => {
    throw new Error("Power BI must not be called for week squad");
  }),
}));
vi.mock("@/lib/powerbi/queries/matchActual.server", () => ({
  getMatchActualGps: vi.fn(() => {
    throw new Error("Power BI must not be called for week squad");
  }),
  getMatchActualGpsBatch: vi.fn(() => {
    throw new Error("Power BI must not be called for week squad");
  }),
}));
vi.mock("@/lib/powerbi/queries/matchCandidates.server", () => ({
  getMatchCandidateDates: vi.fn(() => {
    throw new Error("Power BI must not be called for week squad");
  }),
}));
vi.mock("@/lib/powerbi/executeQuery.server", () => ({
  executeQuery: vi.fn(() => {
    throw new Error("Power BI must not be called for week squad");
  }),
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
vi.mock("@/lib/gpsPlanner/playerMappings.server", () => ({
  listPlayerMappings: vi.fn(),
  listPowerBiPlayerCandidates: vi.fn(),
  createPlayerMapping: vi.fn(),
  updatePlayerMapping: vi.fn(),
}));

import {
  listPlannerWeekPlayers,
  savePlannerWeekPlayers,
} from "@/lib/gpsPlanner/weekPlayers.server";
import {
  listPlannerWeekPlayersAction,
  savePlannerWeekPlayersAction,
} from "@/app/actions/gpsPlanner";

const ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "a@t.com",
  role: "admin" as const,
};
const WEEK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const P1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const P2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function chain(
  result: { data: unknown; error: unknown },
  opts?: { maybeSingle?: boolean }
) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  for (const key of ["select", "eq", "in", "order", "insert", "update", "delete"]) {
    api[key] = vi.fn(self);
  }
  if (opts?.maybeSingle) {
    api.maybeSingle = vi.fn().mockResolvedValue(result);
  } else {
    Object.assign(api, {
      then: (resolve: (v: unknown) => unknown) => resolve(result),
    });
  }
  return api;
}

describe("listPlannerWeekPlayers", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    rpcMock.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("rejects unauthorized list", async () => {
    getAppUser.mockResolvedValue(null);
    await expect(listPlannerWeekPlayers(WEEK_ID)).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects staff", async () => {
    getAppUser.mockResolvedValue({ ...ADMIN, role: "staff" });
    await expect(listPlannerWeekPlayers(WEEK_ID)).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
  });

  it("rejects invalid weekId", async () => {
    await expect(listPlannerWeekPlayers("not-a-uuid")).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid_input" },
    });
  });

  it("rejects missing week", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks") {
        return chain({ data: null, error: null }, { maybeSingle: true });
      }
      throw new Error(`unexpected table ${table}`);
    });
    await expect(listPlannerWeekPlayers(WEEK_ID)).resolves.toMatchObject({
      ok: false,
      error: { code: "week_not_found" },
    });
  });

  it("returns exact membership ids from planner_week_players only", async () => {
    const touched = new Set<string>();
    fromMock.mockImplementation((table: string) => {
      touched.add(table);
      if (table === "planner_weeks") {
        return chain({ data: { id: WEEK_ID }, error: null }, { maybeSingle: true });
      }
      if (table === "planner_week_players") {
        return chain({
          data: [{ player_id: P1 }, { player_id: P2 }],
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });

    await expect(listPlannerWeekPlayers(WEEK_ID)).resolves.toEqual({
      ok: true,
      data: { playerIds: [P1, P2] },
    });
    expect(touched.has("planner_week_players")).toBe(true);
    expect(touched.has("planner_weekly_targets")).toBe(false);
    expect(touched.has("planner_daily_targets")).toBe(false);
    expect(touched.has("planner_match_best_snapshots")).toBe(false);
    expect(touched.has("planner_groups")).toBe(false);
    expect(touched.has("planner_group_members")).toBe(false);
    expect(touched.has("profiles")).toBe(false);
  });

  it("returns empty playerIds when the week has no membership", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks") {
        return chain({ data: { id: WEEK_ID }, error: null }, { maybeSingle: true });
      }
      if (table === "planner_week_players") {
        return chain({ data: [], error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });
    await expect(listPlannerWeekPlayers(WEEK_ID)).resolves.toEqual({
      ok: true,
      data: { playerIds: [] },
    });
  });

  it("maps membership DB error", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks") {
        return chain({ data: { id: WEEK_ID }, error: null }, { maybeSingle: true });
      }
      if (table === "planner_week_players") {
        return chain({
          data: null,
          error: { message: "relation missing", code: "42P01" },
        });
      }
      throw new Error(`unexpected table ${table}`);
    });
    await expect(listPlannerWeekPlayers(WEEK_ID)).resolves.toMatchObject({
      ok: false,
      error: { code: "database_error" },
    });
  });

  it("list action preserves Admin guard", async () => {
    getAppUser.mockResolvedValue(null);
    await expect(listPlannerWeekPlayersAction(WEEK_ID)).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    expect(fromMock).not.toHaveBeenCalled();
  });
});

const SAVE_CHANGED = {
  savedPlayerIds: [P1, P2],
  addedPlayerIds: [P2],
  removedPlayerIds: [],
  changed: true,
};

const SAVE_NO_CHANGE = {
  savedPlayerIds: [P1],
  addedPlayerIds: [],
  removedPlayerIds: [],
  changed: false,
};

describe("savePlannerWeekPlayers", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    rpcMock.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("rejects unauthorized save", async () => {
    getAppUser.mockResolvedValue(null);
    await expect(
      savePlannerWeekPlayers({ weekId: WEEK_ID, selectedPlayerIds: [P1] })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects staff save", async () => {
    getAppUser.mockResolvedValue({ ...ADMIN, role: "staff" });
    await expect(
      savePlannerWeekPlayers({ weekId: WEEK_ID, selectedPlayerIds: [P1] })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects invalid weekId", async () => {
    await expect(
      savePlannerWeekPlayers({ weekId: "not-a-uuid", selectedPlayerIds: [P1] })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid_input" },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects null selectedPlayerIds without converting to empty squad", async () => {
    await expect(
      savePlannerWeekPlayers({
        weekId: WEEK_ID,
        selectedPlayerIds: null as unknown as string[],
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid_input" },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects undefined selectedPlayerIds without converting to empty squad", async () => {
    await expect(
      savePlannerWeekPlayers({
        weekId: WEEK_ID,
        selectedPlayerIds: undefined as unknown as string[],
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid_input" },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects non-array selectedPlayerIds", async () => {
    await expect(
      savePlannerWeekPlayers({
        weekId: WEEK_ID,
        selectedPlayerIds: P1 as unknown as string[],
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid_input" },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects null-like player ids inside the array", async () => {
    await expect(
      savePlannerWeekPlayers({
        weekId: WEEK_ID,
        selectedPlayerIds: [P1, null as unknown as string],
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid_input" },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls only planner_save_week_players with weekId and normalized ids", async () => {
    rpcMock.mockResolvedValue({ data: SAVE_CHANGED, error: null });
    await expect(
      savePlannerWeekPlayers({
        weekId: WEEK_ID,
        selectedPlayerIds: [P1, P2],
      })
    ).resolves.toEqual({ ok: true, data: SAVE_CHANGED });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("planner_save_week_players", {
      p_week_id: WEEK_ID,
      p_player_ids: [P1, P2],
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("deduplicates selected player ids before RPC", async () => {
    rpcMock.mockResolvedValue({ data: SAVE_CHANGED, error: null });
    await savePlannerWeekPlayers({
      weekId: WEEK_ID,
      selectedPlayerIds: [P1, P2, P1],
    });
    expect(rpcMock).toHaveBeenCalledWith("planner_save_week_players", {
      p_week_id: WEEK_ID,
      p_player_ids: [P1, P2],
    });
  });

  it("accepts explicit empty selection and passes []", async () => {
    const emptyResult = {
      savedPlayerIds: [],
      addedPlayerIds: [],
      removedPlayerIds: [P1],
      changed: true,
    };
    rpcMock.mockResolvedValue({ data: emptyResult, error: null });
    await expect(
      savePlannerWeekPlayers({ weekId: WEEK_ID, selectedPlayerIds: [] })
    ).resolves.toEqual({ ok: true, data: emptyResult });
    expect(rpcMock).toHaveBeenCalledWith("planner_save_week_players", {
      p_week_id: WEEK_ID,
      p_player_ids: [],
    });
  });

  it("preserves successful no-change result", async () => {
    rpcMock.mockResolvedValue({ data: SAVE_NO_CHANGE, error: null });
    await expect(
      savePlannerWeekPlayers({ weekId: WEEK_ID, selectedPlayerIds: [P1] })
    ).resolves.toEqual({ ok: true, data: SAVE_NO_CHANGE });
  });

  it("preserves addedPlayerIds and removedPlayerIds from RPC", async () => {
    const result = {
      savedPlayerIds: [P2],
      addedPlayerIds: [P2],
      removedPlayerIds: [P1],
      changed: true,
    };
    rpcMock.mockResolvedValue({ data: result, error: null });
    await expect(
      savePlannerWeekPlayers({ weekId: WEEK_ID, selectedPlayerIds: [P2] })
    ).resolves.toEqual({ ok: true, data: result });
  });

  it("rejects malformed RPC result", async () => {
    rpcMock.mockResolvedValue({
      data: { savedPlayerIds: [P1], changed: true },
      error: null,
    });
    await expect(
      savePlannerWeekPlayers({ weekId: WEEK_ID, selectedPlayerIds: [P1] })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "database_error" },
    });
  });

  it("rejects null array fields in RPC result", async () => {
    rpcMock.mockResolvedValue({
      data: {
        savedPlayerIds: [P1],
        addedPlayerIds: null,
        removedPlayerIds: [],
        changed: false,
      },
      error: null,
    });
    await expect(
      savePlannerWeekPlayers({ weekId: WEEK_ID, selectedPlayerIds: [P1] })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "database_error" },
    });
  });

  it("does not report RPC error as success", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "Admin access required.", code: "42501" },
    });
    await expect(
      savePlannerWeekPlayers({ weekId: WEEK_ID, selectedPlayerIds: [P1] })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
  });

  it("maps invalid-player RPC error", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: "player_ids must all exist in profiles with role = player",
        code: "P0001",
      },
    });
    await expect(
      savePlannerWeekPlayers({ weekId: WEEK_ID, selectedPlayerIds: [P1] })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "not_a_player" },
    });
  });

  it("maps missing-week RPC error", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "Planner week was not found.", code: "P0002" },
    });
    await expect(
      savePlannerWeekPlayers({ weekId: WEEK_ID, selectedPlayerIds: [P1] })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "week_not_found" },
    });
  });

  it("maps generic RPC failure without leaking SQL", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "deadlock detected on planner_week_players", code: "40P01" },
    });
    const result = await savePlannerWeekPlayers({
      weekId: WEEK_ID,
      selectedPlayerIds: [P1],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("database_error");
    expect(result.error.message).not.toMatch(/deadlock|sql|planner_week_players/i);
  });

  it("never uses direct membership insert/delete or target tables", async () => {
    rpcMock.mockResolvedValue({ data: SAVE_CHANGED, error: null });
    await savePlannerWeekPlayers({
      weekId: WEEK_ID,
      selectedPlayerIds: [P1, P2],
    });
    expect(fromMock).not.toHaveBeenCalled();
    const rpcName = rpcMock.mock.calls[0]?.[0];
    expect(rpcName).toBe("planner_save_week_players");
    expect(rpcName).not.toMatch(/weekly_target|daily_target|snapshot|group/i);
  });
});

describe("savePlannerWeekPlayersAction", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    rpcMock.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("preserves Admin guard at the action layer", async () => {
    getAppUser.mockResolvedValue(null);
    await expect(
      savePlannerWeekPlayersAction({
        weekId: WEEK_ID,
        selectedPlayerIds: [P1],
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns typed Save result from RPC", async () => {
    rpcMock.mockResolvedValue({ data: SAVE_CHANGED, error: null });
    await expect(
      savePlannerWeekPlayersAction({
        weekId: WEEK_ID,
        selectedPlayerIds: [P1, P2],
      })
    ).resolves.toEqual({ ok: true, data: SAVE_CHANGED });
  });
});
