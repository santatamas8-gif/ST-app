import { readFileSync } from "node:fs";
import { join } from "node:path";
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
    throw new Error("Power BI must not be called during plan detection");
  }),
}));
vi.mock("@/lib/powerbi/queries/matchBest.server", () => ({
  getMatchBestGps: vi.fn(() => {
    throw new Error("Power BI must not be called during plan detection");
  }),
}));
vi.mock("@/lib/powerbi/queries/trainingActual.server", () => ({
  getTrainingActualGps: vi.fn(() => {
    throw new Error("Power BI must not be called during plan detection");
  }),
}));
vi.mock("@/lib/powerbi/queries/matchActual.server", () => ({
  getMatchActualGps: vi.fn(() => {
    throw new Error("Power BI must not be called during plan detection");
  }),
  getMatchActualGpsBatch: vi.fn(() => {
    throw new Error("Power BI must not be called during plan detection");
  }),
}));
vi.mock("@/lib/powerbi/queries/matchCandidates.server", () => ({
  getMatchCandidateDates: vi.fn(() => {
    throw new Error("Power BI must not be called during plan detection");
  }),
}));
vi.mock("@/lib/powerbi/executeQuery.server", () => ({
  executeQuery: vi.fn(() => {
    throw new Error("Power BI must not be called during plan detection");
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
  deletePlayerMapping: vi.fn(),
  getPlayerMapping: vi.fn(),
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

vi.mock("@/lib/gpsPlanner/weekPlayers.server", () => ({
  listPlannerWeekPlayers: vi.fn(),
  savePlannerWeekPlayers: vi.fn(),
}));

import {
  buildReusablePlanKey,
  buildReusablePlans,
  classifyAddedPlayersForInheritance,
  sourceSquadPlayerIds,
} from "@/lib/gpsPlanner/weekPlanInheritance";
import {
  analyzePlannerWeekPlanInheritance,
  applyPlannerExistingPlan,
} from "@/lib/gpsPlanner/weekPlanInheritance.server";
import {
  analyzePlannerWeekPlanInheritanceAction,
  applyPlannerExistingPlanAction,
} from "@/app/actions/gpsPlanner";
import * as groupsServer from "@/lib/gpsPlanner/groups.server";
import * as weeklyTargetsServer from "@/lib/gpsPlanner/weeklyTargets.server";
import * as dailyTargetsServer from "@/lib/gpsPlanner/dailyTargets.server";
import * as weekPlayersServer from "@/lib/gpsPlanner/weekPlayers.server";
import type { PercentageMetrics } from "@/lib/gpsPlanner/calculations";

const listPlannerGroups = vi.mocked(groupsServer.listPlannerGroups);
const createPlannerGroup = vi.mocked(groupsServer.createPlannerGroup);
const updatePlannerGroup = vi.mocked(groupsServer.updatePlannerGroup);
const deletePlannerGroup = vi.mocked(groupsServer.deletePlannerGroup);
const addPlannerGroupMember = vi.mocked(groupsServer.addPlannerGroupMember);
const removePlannerGroupMember = vi.mocked(groupsServer.removePlannerGroupMember);
const createPlannerWeeklyTarget = vi.mocked(
  weeklyTargetsServer.createPlannerWeeklyTarget
);
const updatePlannerWeeklyTarget = vi.mocked(
  weeklyTargetsServer.updatePlannerWeeklyTarget
);
const createPlannerDailyTarget = vi.mocked(
  dailyTargetsServer.createPlannerDailyTarget
);
const updatePlannerDailyTarget = vi.mocked(
  dailyTargetsServer.updatePlannerDailyTarget
);
const savePlannerWeekPlayers = vi.mocked(weekPlayersServer.savePlannerWeekPlayers);

const ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "a@t.com",
  role: "admin" as const,
};
const WEEK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const P1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const P2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const P3 = "dddddddd-dddd-4ddd-8ddd-dddddddd0001";
const P4 = "dddddddd-dddd-4ddd-8ddd-dddddddd0002";
const DAY1 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const DAY2 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2";

const WEEKLY_A: PercentageMetrics = {
  tdPct: 135,
  hsrPct: 140,
  sprintPct: 120,
  accPct: 130,
  decPct: 130,
};
const WEEKLY_B: PercentageMetrics = {
  tdPct: 150,
  hsrPct: 140,
  sprintPct: 120,
  accPct: 130,
  decPct: 130,
};
const DAILY_1: PercentageMetrics = {
  tdPct: 50,
  hsrPct: 60,
  sprintPct: 60,
  accPct: 90,
  decPct: 90,
};
const DAILY_2: PercentageMetrics = {
  tdPct: 40,
  hsrPct: 20,
  sprintPct: 10,
  accPct: 40,
  decPct: 40,
};
const DAILY_2_ALT: PercentageMetrics = {
  tdPct: 45,
  hsrPct: 20,
  sprintPct: 10,
  accPct: 40,
  decPct: 40,
};

const TRAINING_DAYS = [
  { weekDayId: DAY1, mdTag: "MD-3", date: "2026-08-16", displayOrder: 1 },
  { weekDayId: DAY2, mdTag: "MD-2", date: "2026-08-17", displayOrder: 2 },
];

function weeklyRow(playerId: string, pct: PercentageMetrics) {
  return {
    player_id: playerId,
    td_pct: pct.tdPct,
    hsr_pct: pct.hsrPct,
    sprint_pct: pct.sprintPct,
    acc_pct: pct.accPct,
    dec_pct: pct.decPct,
  };
}

function dailyRow(
  playerId: string,
  weekDayId: string,
  pct: PercentageMetrics
) {
  return {
    player_id: playerId,
    week_day_id: weekDayId,
    td_pct: pct.tdPct,
    hsr_pct: pct.hsrPct,
    sprint_pct: pct.sprintPct,
    acc_pct: pct.accPct,
    dec_pct: pct.decPct,
  };
}

function completeDaily(playerId: string) {
  return [
    dailyRow(playerId, DAY1, DAILY_1),
    dailyRow(playerId, DAY2, DAILY_2),
  ];
}

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

const FORBIDDEN_TABLES = new Set([
  "planner_groups",
  "planner_group_members",
  "planner_week_official_matches",
  "planner_match_best_snapshots",
]);

function mockContext(input: {
  saved?: string[];
  weekly?: ReturnType<typeof weeklyRow>[];
  daily?: ReturnType<typeof dailyRow>[];
  days?: Array<{
    id: string;
    date: string;
    md_tag: string;
    display_order: number;
  }>;
}) {
  const saved = input.saved ?? [P1, P2];
  const weekly = input.weekly ?? [weeklyRow(P1, WEEKLY_A)];
  const daily = input.daily ?? completeDaily(P1);
  const days = input.days ?? [
    { id: DAY1, date: "2026-08-16", md_tag: "MD-3", display_order: 1 },
    { id: DAY2, date: "2026-08-17", md_tag: "MD-2", display_order: 2 },
  ];
  const touched = new Set<string>();

  fromMock.mockImplementation((table: string) => {
    touched.add(table);
    if (FORBIDDEN_TABLES.has(table)) {
      throw new Error(`plan inheritance must not read ${table}`);
    }
    if (table === "planner_weeks") {
      return chain({ data: { id: WEEK_ID }, error: null }, { maybeSingle: true });
    }
    if (table === "planner_week_players") {
      return chain({
        data: saved.map((player_id) => ({ player_id })),
        error: null,
      });
    }
    if (table === "planner_week_days") {
      return chain({ data: days, error: null });
    }
    if (table === "planner_weekly_targets") {
      return chain({ data: weekly, error: null });
    }
    if (table === "planner_daily_targets") {
      return chain({ data: daily, error: null });
    }
    throw new Error(`unexpected table ${table}`);
  });

  return touched;
}

function planAKey() {
  return buildReusablePlanKey(WEEKLY_A, [
    { weekDayId: DAY1, pct: DAILY_1 },
    { weekDayId: DAY2, pct: DAILY_2 },
  ]);
}

describe("plan inheritance pure helpers", () => {
  it("1. zero source complete plans → []", () => {
    expect(
      buildReusablePlans({
        sourcePlayerIds: [P1],
        trainingDays: TRAINING_DAYS,
        weeklyByPlayerId: new Map(),
        dailyByPlayerAndDay: new Map(),
      })
    ).toEqual([]);
  });

  it("2. one complete plan detected", () => {
    const plans = buildReusablePlans({
      sourcePlayerIds: [P1],
      trainingDays: TRAINING_DAYS,
      weeklyByPlayerId: new Map([[P1, WEEKLY_A]]),
      dailyByPlayerAndDay: new Map([
        [
          P1,
          new Map([
            [DAY1, DAILY_1],
            [DAY2, DAILY_2],
          ]),
        ],
      ]),
    });
    expect(plans).toHaveLength(1);
    expect(plans[0].playerCount).toBe(1);
    expect(plans[0].planKey).toBe(planAKey());
    expect(plans[0].weeklyPct).toEqual(WEEKLY_A);
  });

  it("3. identical plans clustered", () => {
    const plans = buildReusablePlans({
      sourcePlayerIds: [P1, P2],
      trainingDays: TRAINING_DAYS,
      weeklyByPlayerId: new Map([
        [P1, WEEKLY_A],
        [P2, WEEKLY_A],
      ]),
      dailyByPlayerAndDay: new Map([
        [
          P1,
          new Map([
            [DAY1, DAILY_1],
            [DAY2, DAILY_2],
          ]),
        ],
        [
          P2,
          new Map([
            [DAY1, DAILY_1],
            [DAY2, DAILY_2],
          ]),
        ],
      ]),
    });
    expect(plans).toHaveLength(1);
    expect(plans[0].playerCount).toBe(2);
  });

  it("4. differing Weekly % → separate plans", () => {
    const plans = buildReusablePlans({
      sourcePlayerIds: [P1, P2],
      trainingDays: TRAINING_DAYS,
      weeklyByPlayerId: new Map([
        [P1, WEEKLY_A],
        [P2, WEEKLY_B],
      ]),
      dailyByPlayerAndDay: new Map([
        [
          P1,
          new Map([
            [DAY1, DAILY_1],
            [DAY2, DAILY_2],
          ]),
        ],
        [
          P2,
          new Map([
            [DAY1, DAILY_1],
            [DAY2, DAILY_2],
          ]),
        ],
      ]),
    });
    expect(plans).toHaveLength(2);
    expect(plans.map((p) => p.planKey).sort()).not.toContain("");
    expect(new Set(plans.map((p) => p.planKey)).size).toBe(2);
  });

  it("5. differing Daily % → separate plans", () => {
    const plans = buildReusablePlans({
      sourcePlayerIds: [P1, P2],
      trainingDays: TRAINING_DAYS,
      weeklyByPlayerId: new Map([
        [P1, WEEKLY_A],
        [P2, WEEKLY_A],
      ]),
      dailyByPlayerAndDay: new Map([
        [
          P1,
          new Map([
            [DAY1, DAILY_1],
            [DAY2, DAILY_2],
          ]),
        ],
        [
          P2,
          new Map([
            [DAY1, DAILY_1],
            [DAY2, DAILY_2_ALT],
          ]),
        ],
      ]),
    });
    expect(plans).toHaveLength(2);
  });

  it("6. missing one Daily day → source excluded", () => {
    const plans = buildReusablePlans({
      sourcePlayerIds: [P1],
      trainingDays: TRAINING_DAYS,
      weeklyByPlayerId: new Map([[P1, WEEKLY_A]]),
      dailyByPlayerAndDay: new Map([[P1, new Map([[DAY1, DAILY_1]])]]),
    });
    expect(plans).toEqual([]);
  });

  it("7. Match rows are not part of the signature", () => {
    const withTrainingOnly = buildReusablePlanKey(WEEKLY_A, [
      { weekDayId: DAY1, pct: DAILY_1 },
      { weekDayId: DAY2, pct: DAILY_2 },
    ]);
    const plans = buildReusablePlans({
      sourcePlayerIds: [P1],
      trainingDays: TRAINING_DAYS,
      weeklyByPlayerId: new Map([[P1, WEEKLY_A]]),
      dailyByPlayerAndDay: new Map([
        [
          P1,
          new Map([
            [DAY1, DAILY_1],
            [DAY2, DAILY_2],
            ["match-row-id-not-a-training-day", DAILY_1],
          ]),
        ],
      ]),
    });
    expect(plans).toHaveLength(1);
    expect(plans[0].planKey).toBe(withTrainingOnly);
    expect(plans[0].daily.map((d) => d.weekDayId)).toEqual([DAY1, DAY2]);
  });

  it("8. newly added players excluded as source", () => {
    expect(sourceSquadPlayerIds([P1, P2, P3], [P3])).toEqual([P1, P2]);
    const plans = buildReusablePlans({
      sourcePlayerIds: sourceSquadPlayerIds([P1, P3], [P3]),
      trainingDays: TRAINING_DAYS,
      weeklyByPlayerId: new Map([[P3, WEEKLY_A]]),
      dailyByPlayerAndDay: new Map([
        [
          P3,
          new Map([
            [DAY1, DAILY_1],
            [DAY2, DAILY_2],
          ]),
        ],
      ]),
    });
    expect(plans).toEqual([]);
  });

  it("9–10. returning vs eligible added players", () => {
    const classified = classifyAddedPlayersForInheritance(
      [P2, P3],
      new Set([P2])
    );
    expect(classified.returningPlayerIds).toEqual([P2]);
    expect(classified.eligibleNewPlayerIds).toEqual([P3]);
  });

  it("11–12. no-plan and deterministic planKey", () => {
    expect(planAKey()).toMatch(/^[a-f0-9]{64}$/);
    expect(planAKey()).toBe(planAKey());
    expect(buildReusablePlans({
      sourcePlayerIds: [],
      trainingDays: TRAINING_DAYS,
      weeklyByPlayerId: new Map(),
      dailyByPlayerAndDay: new Map(),
    })).toEqual([]);
  });
});

describe("analyzePlannerWeekPlanInheritance", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    rpcMock.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
    listPlannerGroups.mockReset();
    savePlannerWeekPlayers.mockReset();
  });

  it("rejects staff / player (admin guard)", async () => {
    getAppUser.mockResolvedValue({ ...ADMIN, role: "staff" });
    await expect(
      analyzePlannerWeekPlanInheritance({
        weekId: WEEK_ID,
        addedPlayerIds: [P3],
      })
    ).resolves.toMatchObject({ ok: false, error: { code: "unauthorized" } });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("11. Groups are not used for detection", async () => {
    mockContext({});
    const result = await analyzePlannerWeekPlanInheritance({
      weekId: WEEK_ID,
      addedPlayerIds: [P3],
    });
    expect(result.ok).toBe(true);
    expect(listPlannerGroups).not.toHaveBeenCalled();
    expect(createPlannerGroup).not.toHaveBeenCalled();
  });

  it("12. detection does not call Power BI or membership RPC", async () => {
    mockContext({});
    const result = await analyzePlannerWeekPlanInheritance({
      weekId: WEEK_ID,
      addedPlayerIds: [P3],
    });
    expect(result.ok).toBe(true);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(savePlannerWeekPlayers).not.toHaveBeenCalled();
  });

  it("classifies returning / eligible and returns one clustered plan", async () => {
    mockContext({
      saved: [P1, P2, P3, P4],
      weekly: [weeklyRow(P1, WEEKLY_A), weeklyRow(P2, WEEKLY_A), weeklyRow(P4, WEEKLY_A)],
      daily: [...completeDaily(P1), ...completeDaily(P2)],
    });
    const result = await analyzePlannerWeekPlanInheritance({
      weekId: WEEK_ID,
      addedPlayerIds: [P3, P4],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.eligibleNewPlayerIds).toEqual([P3]);
    expect(result.data.returningPlayerIds).toEqual([P4]);
    expect(result.data.reusablePlans).toHaveLength(1);
    expect(result.data.reusablePlans[0].playerCount).toBe(2);
    expect(result.data.reusablePlans[0].planKey).toBe(planAKey());
  });

  it("11. no complete plan returns [] without error", async () => {
    mockContext({
      weekly: [weeklyRow(P1, WEEKLY_A)],
      daily: [dailyRow(P1, DAY1, DAILY_1)],
    });
    const result = await analyzePlannerWeekPlanInheritance({
      weekId: WEEK_ID,
      addedPlayerIds: [P3],
    });
    expect(result).toEqual({
      ok: true,
      data: {
        eligibleNewPlayerIds: [P3],
        returningPlayerIds: [],
        reusablePlans: [],
      },
    });
  });
});

describe("applyPlannerExistingPlan", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    rpcMock.mockReset();
    createPlannerWeeklyTarget.mockReset();
    createPlannerDailyTarget.mockReset();
    updatePlannerWeeklyTarget.mockReset();
    updatePlannerDailyTarget.mockReset();
    savePlannerWeekPlayers.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
    createPlannerWeeklyTarget.mockResolvedValue({
      ok: true,
      data: { snapshotCreated: false } as never,
    });
    createPlannerDailyTarget.mockResolvedValue({
      ok: true,
      data: {} as never,
    });
  });

  it("26. rejects non-admin before any apply", async () => {
    getAppUser.mockResolvedValue({ ...ADMIN, role: "player" });
    await expect(
      applyPlannerExistingPlan({
        weekId: WEEK_ID,
        targetPlayerIds: [P3],
        planKey: planAKey(),
      })
    ).resolves.toMatchObject({ ok: false, error: { code: "unauthorized" } });
    expect(createPlannerWeeklyTarget).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("13. valid planKey is revalidated then applied", async () => {
    mockContext({ saved: [P1, P3] });
    const result = await applyPlannerExistingPlan({
      weekId: WEEK_ID,
      targetPlayerIds: [P3],
      planKey: planAKey(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.planKey).toBe(planAKey());
    expect(result.data.outcomes).toEqual([
      expect.objectContaining({ playerId: P3, status: "applied", weeklyCreated: true }),
    ]);
  });

  it("14. stale planKey is rejected without writes", async () => {
    mockContext({});
    const result = await applyPlannerExistingPlan({
      weekId: WEEK_ID,
      targetPlayerIds: [P3],
      planKey: "deadbeef".repeat(8),
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "stale_plan" },
    });
    expect(createPlannerWeeklyTarget).not.toHaveBeenCalled();
    expect(createPlannerDailyTarget).not.toHaveBeenCalled();
  });

  it("15. existing-target player is not overwritten", async () => {
    mockContext({
      saved: [P1, P2],
      weekly: [weeklyRow(P1, WEEKLY_A), weeklyRow(P2, WEEKLY_B)],
      daily: completeDaily(P1),
    });
    const result = await applyPlannerExistingPlan({
      weekId: WEEK_ID,
      targetPlayerIds: [P2],
      planKey: planAKey(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.outcomes).toEqual([
      expect.objectContaining({
        playerId: P2,
        status: "already_has_targets",
        weeklyCreated: false,
      }),
    ]);
    expect(createPlannerWeeklyTarget).not.toHaveBeenCalled();
    expect(updatePlannerWeeklyTarget).not.toHaveBeenCalled();
  });

  it("16–20. targetless player uses create path with percentages only", async () => {
    mockContext({ saved: [P1, P3] });
    await applyPlannerExistingPlan({
      weekId: WEEK_ID,
      targetPlayerIds: [P3],
      planKey: planAKey(),
    });

    expect(createPlannerWeeklyTarget).toHaveBeenCalledTimes(1);
    expect(createPlannerWeeklyTarget.mock.calls[0][0]).toEqual({
      weekId: WEEK_ID,
      playerId: P3,
      tdPct: WEEKLY_A.tdPct,
      hsrPct: WEEKLY_A.hsrPct,
      sprintPct: WEEKLY_A.sprintPct,
      accPct: WEEKLY_A.accPct,
      decPct: WEEKLY_A.decPct,
    });
    const weeklyArg = createPlannerWeeklyTarget.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(weeklyArg).not.toHaveProperty("tdBest");
    expect(weeklyArg).not.toHaveProperty("totalDistance");
    expect(weeklyArg).not.toHaveProperty("hsrBest");

    expect(createPlannerDailyTarget).toHaveBeenCalledTimes(2);
    expect(createPlannerDailyTarget.mock.calls.map((c) => c[0])).toEqual([
      {
        weekDayId: DAY1,
        playerId: P3,
        tdPct: DAILY_1.tdPct,
        hsrPct: DAILY_1.hsrPct,
        sprintPct: DAILY_1.sprintPct,
        accPct: DAILY_1.accPct,
        decPct: DAILY_1.decPct,
      },
      {
        weekDayId: DAY2,
        playerId: P3,
        tdPct: DAILY_2.tdPct,
        hsrPct: DAILY_2.hsrPct,
        sprintPct: DAILY_2.sprintPct,
        accPct: DAILY_2.accPct,
        decPct: DAILY_2.decPct,
      },
    ]);
    expect(updatePlannerWeeklyTarget).not.toHaveBeenCalled();
    expect(updatePlannerDailyTarget).not.toHaveBeenCalled();
  });

  it("21–22. multi-player results; one failure is not total success", async () => {
    mockContext({ saved: [P1, P3, P4] });
    createPlannerWeeklyTarget.mockImplementation(async (input) => {
      if (input.playerId === P4) {
        return {
          ok: false,
          error: {
            code: "mapping_not_found",
            message: "No Power BI mapping found for this player.",
          },
        };
      }
      return { ok: true, data: { snapshotCreated: false } as never };
    });

    const result = await applyPlannerExistingPlan({
      weekId: WEEK_ID,
      targetPlayerIds: [P3, P4],
      planKey: planAKey(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.outcomes).toHaveLength(2);
    expect(result.data.outcomes[0]).toMatchObject({ playerId: P3, status: "applied" });
    expect(result.data.outcomes[1]).toMatchObject({
      playerId: P4,
      status: "failed",
      weeklyCreated: false,
    });
    expect(result.data.outcomes.every((row) => row.status === "applied")).toBe(false);
    expect(createPlannerDailyTarget).toHaveBeenCalledTimes(2);
  });

  it("reports Weekly success + Daily failure without hiding partial state", async () => {
    mockContext({ saved: [P1, P3] });
    createPlannerDailyTarget
      .mockResolvedValueOnce({ ok: true, data: {} as never })
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "database_error", message: "Could not save daily target." },
      });

    const result = await applyPlannerExistingPlan({
      weekId: WEEK_ID,
      targetPlayerIds: [P3],
      planKey: planAKey(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.outcomes[0]).toMatchObject({
      status: "failed",
      weeklyCreated: true,
    });
    expect(result.data.outcomes[0].daily).toEqual([
      { weekDayId: DAY1, status: "created" },
      {
        weekDayId: DAY2,
        status: "failed",
        message: "Could not save daily target.",
      },
    ]);
  });

  it("23–24. Apply never writes membership or Groups", async () => {
    mockContext({ saved: [P1, P3] });
    await applyPlannerExistingPlan({
      weekId: WEEK_ID,
      targetPlayerIds: [P3],
      planKey: planAKey(),
    });
    expect(savePlannerWeekPlayers).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
    expect(createPlannerGroup).not.toHaveBeenCalled();
    expect(updatePlannerGroup).not.toHaveBeenCalled();
    expect(deletePlannerGroup).not.toHaveBeenCalled();
    expect(addPlannerGroupMember).not.toHaveBeenCalled();
    expect(removePlannerGroupMember).not.toHaveBeenCalled();
  });
});

describe("actions + source contract", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
    mockContext({});
  });

  it("26. action wrappers preserve admin guard", async () => {
    getAppUser.mockResolvedValue({ ...ADMIN, role: "staff" });
    await expect(
      analyzePlannerWeekPlanInheritanceAction({
        weekId: WEEK_ID,
        addedPlayerIds: [P3],
      })
    ).resolves.toMatchObject({ ok: false, error: { code: "unauthorized" } });
    await expect(
      applyPlannerExistingPlanAction({
        weekId: WEEK_ID,
        targetPlayerIds: [P3],
        planKey: planAKey(),
      })
    ).resolves.toMatchObject({ ok: false, error: { code: "unauthorized" } });
  });

  it("25. no new Power BI query path; Save Squad untouched", () => {
    const root = process.cwd();
    const server = readFileSync(
      join(root, "lib/gpsPlanner/weekPlanInheritance.server.ts"),
      "utf8"
    );
    const pure = readFileSync(
      join(root, "lib/gpsPlanner/weekPlanInheritance.ts"),
      "utf8"
    );
    const actions = readFileSync(join(root, "app/actions/gpsPlanner.ts"), "utf8");
    const weekPlayers = readFileSync(
      join(root, "lib/gpsPlanner/weekPlayers.server.ts"),
      "utf8"
    );
    const ui = readFileSync(
      join(root, "app/(app)/admin/planner/WeeklyPlannerView.tsx"),
      "utf8"
    );

    expect(server).not.toMatch(/lib\/powerbi/);
    expect(pure).not.toMatch(/lib\/powerbi/);
    expect(server).not.toMatch(/groups\.server/);
    expect(server).not.toMatch(/savePlannerWeekPlayers/);
    expect(server).not.toMatch(/planner_save_week_players/);
    expect(server).not.toMatch(/updatePlannerWeeklyTarget/);
    expect(server).not.toMatch(/updatePlannerDailyTarget/);
    expect(server).not.toMatch(/applyWeeklyTargetsToPlayers/);
    expect(server).not.toMatch(/applyDailyDistributionToPlayers/);
    expect(server).toContain("createPlannerWeeklyTarget");
    expect(server).toContain("createPlannerDailyTarget");
    expect(actions).toContain("analyzePlannerWeekPlanInheritanceAction");
    expect(actions).toContain("applyPlannerExistingPlanAction");
    expect(weekPlayers).toContain("planner_save_week_players");
    expect(weekPlayers).not.toContain("weekPlanInheritance");
    expect(ui).not.toContain("analyzePlannerWeekPlanInheritance");
    expect(ui).not.toContain("applyPlannerExistingPlan");
    expect(ui).not.toContain("Apply existing plan");
  });
});
