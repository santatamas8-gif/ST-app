import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getAppUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getAppUser: (...args: unknown[]) => getAppUser(...args),
  isAdmin: (role: string) => role === "admin",
}));

const fromMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (...args: unknown[]) => fromMock(...args) }),
}));

const getMatchBestGps = vi.fn();
const getPlayerMapping = vi.fn();
vi.mock("@/lib/powerbi/queries/matchBest.server", () => ({
  getMatchBestGps: (...args: unknown[]) => getMatchBestGps(...args),
}));
vi.mock("@/lib/gpsPlanner/playerMappings.server", () => ({
  getPlayerMapping: (...args: unknown[]) => getPlayerMapping(...args),
}));

import {
  createPlannerDailyTarget,
  deletePlannerDailyTarget,
  getPlannerDailyTarget,
  updatePlannerDailyTarget,
} from "@/lib/gpsPlanner/dailyTargets.server";

const ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "a@t.com",
  role: "admin" as const,
};
const STAFF = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "s@t.com",
  role: "staff" as const,
};
const PLAYER = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "p@t.com",
  role: "player" as const,
};

const WEEK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DAY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PLAYER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const PCT = {
  tdPct: 50,
  hsrPct: 37.5,
  sprintPct: 140.5,
  accPct: 10,
  decPct: 20,
};

function chain(
  result: { data: unknown; error: unknown },
  opts?: { single?: boolean; maybeSingle?: boolean }
) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  for (const key of [
    "select",
    "eq",
    "in",
    "order",
    "insert",
    "update",
    "delete",
  ]) {
    api[key] = vi.fn(self);
  }
  if (opts?.single) api.single = vi.fn().mockResolvedValue(result);
  else if (opts?.maybeSingle)
    api.maybeSingle = vi.fn().mockResolvedValue(result);
  else
    Object.assign(api, {
      then: (resolve: (v: unknown) => unknown) => resolve(result),
    });
  return api;
}

function dayRow() {
  return {
    id: DAY_ID,
    week_id: WEEK_ID,
    date: "2026-03-10",
    md_tag: "MD-1",
  };
}

function snapshotRow() {
  return {
    week_id: WEEK_ID,
    player_id: PLAYER_ID,
    td_best: 800,
    hsr_best: 328,
    sprint_best: 100,
    acc_best: 40,
    dec_best: 35,
    powerbi_player_name: "Frozen Exact Name",
  };
}

function dailyRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    week_id: WEEK_ID,
    week_day_id: DAY_ID,
    player_id: PLAYER_ID,
    td_pct: 50,
    hsr_pct: 37.5,
    sprint_pct: 140.5,
    acc_pct: 10,
    dec_pct: 20,
    created_at: "t",
    updated_at: "t",
    created_by: ADMIN.id,
    updated_by: ADMIN.id,
    ...overrides,
  };
}

describe("daily targets auth", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
  });

  it("rejects unauthenticated / staff / player", async () => {
    getAppUser.mockResolvedValue(null);
    await expect(
      createPlannerDailyTarget({ weekDayId: DAY_ID, playerId: PLAYER_ID, ...PCT })
    ).resolves.toMatchObject({ ok: false, error: { code: "unauthorized" } });
    getAppUser.mockResolvedValue(STAFF);
    await expect(
      createPlannerDailyTarget({ weekDayId: DAY_ID, playerId: PLAYER_ID, ...PCT })
    ).resolves.toMatchObject({ ok: false, error: { code: "unauthorized" } });
    getAppUser.mockResolvedValue(PLAYER);
    await expect(
      createPlannerDailyTarget({ weekDayId: DAY_ID, playerId: PLAYER_ID, ...PCT })
    ).resolves.toMatchObject({ ok: false, error: { code: "unauthorized" } });
  });
});

describe("createPlannerDailyTarget", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    getMatchBestGps.mockReset();
    getPlayerMapping.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("creates valid target using frozen snapshot; no Power BI/mapping", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_week_days")
        return chain({ data: dayRow(), error: null }, { maybeSingle: true });
      if (table === "planner_weekly_targets")
        return chain({ data: { week_id: WEEK_ID }, error: null }, { maybeSingle: true });
      if (table === "planner_match_best_snapshots")
        return chain({ data: snapshotRow(), error: null }, { maybeSingle: true });
      if (table === "planner_daily_targets")
        return chain({ data: dailyRow(), error: null }, { single: true });
      if (table === "profiles")
        return chain({
          data: [{ id: PLAYER_ID, full_name: "Player One", email: null }],
          error: null,
        });
      throw new Error(table);
    });

    const result = await createPlannerDailyTarget({
      weekDayId: DAY_ID,
      playerId: PLAYER_ID,
      ...PCT,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.powerBiPlayerName).toBe("Frozen Exact Name");
    expect(result.data.hsr).toBe(123);
    expect(result.data.sprint).toBe(140.5);
    expect(result.data.totalDistance).toBe(400);
    expect(getMatchBestGps).not.toHaveBeenCalled();
    expect(getPlayerMapping).not.toHaveBeenCalled();
  });

  it("requires weekly target; rejects duplicate and invalid %", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_week_days")
        return chain({ data: dayRow(), error: null }, { maybeSingle: true });
      if (table === "planner_weekly_targets")
        return chain({ data: null, error: null }, { maybeSingle: true });
      throw new Error(table);
    });
    await expect(
      createPlannerDailyTarget({ weekDayId: DAY_ID, playerId: PLAYER_ID, ...PCT })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "weekly_target_not_found" },
    });

    for (const bad of [-1, NaN, Infinity] as number[]) {
      await expect(
        createPlannerDailyTarget({
          weekDayId: DAY_ID,
          playerId: PLAYER_ID,
          tdPct: bad,
          hsrPct: 10,
          sprintPct: 10,
          accPct: 10,
          decPct: 10,
        })
      ).resolves.toMatchObject({
        ok: false,
        error: { code: "invalid_percentage" },
      });
    }

    fromMock.mockImplementation((table: string) => {
      if (table === "planner_week_days")
        return chain({ data: dayRow(), error: null }, { maybeSingle: true });
      if (table === "planner_weekly_targets")
        return chain({ data: { week_id: WEEK_ID }, error: null }, { maybeSingle: true });
      if (table === "planner_match_best_snapshots")
        return chain({ data: snapshotRow(), error: null }, { maybeSingle: true });
      if (table === "planner_daily_targets")
        return chain(
          {
            data: null,
            error: {
              code: "23505",
              message:
                'duplicate key value violates unique constraint "planner_daily_targets_pkey"',
            },
          },
          { single: true }
        );
      throw new Error(table);
    });
    await expect(
      createPlannerDailyTarget({
        weekDayId: DAY_ID,
        playerId: PLAYER_ID,
        tdPct: 300,
        hsrPct: 300,
        sprintPct: 300,
        accPct: 300,
        decPct: 300,
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "daily_target_already_exists" },
    });
  });
});

describe("update / delete / read daily targets", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    getMatchBestGps.mockReset();
    getPlayerMapping.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("updates pct only and recalculates planned", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_week_days")
        return chain({ data: dayRow(), error: null }, { maybeSingle: true });
      if (table === "planner_match_best_snapshots")
        return chain({ data: snapshotRow(), error: null }, { maybeSingle: true });
      if (table === "planner_daily_targets")
        return chain(
          { data: dailyRow({ hsr_pct: 50, td_pct: 50, sprint_pct: 50, acc_pct: 50, dec_pct: 50 }), error: null },
          { maybeSingle: true }
        );
      if (table === "profiles")
        return chain({
          data: [{ id: PLAYER_ID, full_name: "Player One", email: null }],
          error: null,
        });
      throw new Error(table);
    });

    const result = await updatePlannerDailyTarget({
      weekDayId: DAY_ID,
      playerId: PLAYER_ID,
      tdPct: 50,
      hsrPct: 50,
      sprintPct: 50,
      accPct: 50,
      decPct: 50,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.hsr).toBe(164);
    expect(result.data.powerBiPlayerName).toBe("Frozen Exact Name");
    expect(getMatchBestGps).not.toHaveBeenCalled();
    expect(getPlayerMapping).not.toHaveBeenCalled();
  });

  it("delete requires confirm and only deletes daily target", async () => {
    await expect(
      deletePlannerDailyTarget({
        weekDayId: DAY_ID,
        playerId: PLAYER_ID,
        confirm: false as unknown as true,
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "confirmation_required" },
    });

    fromMock.mockImplementation((table: string) => {
      if (table === "planner_daily_targets")
        return chain(
          { data: { week_day_id: DAY_ID, player_id: PLAYER_ID }, error: null },
          { maybeSingle: true }
        );
      throw new Error(table);
    });
    const del = await deletePlannerDailyTarget({
      weekDayId: DAY_ID,
      playerId: PLAYER_ID,
      confirm: true,
    });
    expect(del.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("planner_daily_targets");
    expect(fromMock).not.toHaveBeenCalledWith("planner_weekly_targets");
    expect(fromMock).not.toHaveBeenCalledWith("planner_match_best_snapshots");
    expect(fromMock).not.toHaveBeenCalledWith("planner_week_days");
  });

  it("get returns frozen snapshot and daily planned", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_week_days")
        return chain({ data: dayRow(), error: null }, { maybeSingle: true });
      if (table === "planner_daily_targets")
        return chain({ data: dailyRow(), error: null }, { maybeSingle: true });
      if (table === "planner_match_best_snapshots")
        return chain({ data: snapshotRow(), error: null }, { maybeSingle: true });
      if (table === "profiles")
        return chain({
          data: [{ id: PLAYER_ID, full_name: "Player One", email: null }],
          error: null,
        });
      throw new Error(table);
    });
    const one = await getPlannerDailyTarget(DAY_ID, PLAYER_ID);
    expect(one.ok).toBe(true);
    if (!one.ok || !one.data) return;
    expect(one.data.mdTag).toBe("MD-1");
    expect(one.data.hsr).toBe(123);
  });
});
