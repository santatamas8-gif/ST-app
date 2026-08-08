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

const getPlayerMapping = vi.fn();
vi.mock("@/lib/gpsPlanner/playerMappings.server", () => ({
  getPlayerMapping: (...args: unknown[]) => getPlayerMapping(...args),
  POWERBI_MAPPING_PROVIDER: "powerbi",
}));

const getMatchBestGps = vi.fn();
vi.mock("@/lib/powerbi/queries/matchBest.server", () => ({
  getMatchBestGps: (...args: unknown[]) => getMatchBestGps(...args),
}));

import {
  createPlannerWeeklyTarget,
  deletePlannerWeeklyTarget,
  getPlannerMatchBestSnapshot,
  getPlannerWeeklyTarget,
  listPlannerWeeklyTargets,
  updatePlannerWeeklyTarget,
} from "@/lib/gpsPlanner/weeklyTargets.server";

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
const PLAYER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const PCT = {
  tdPct: 140,
  hsrPct: 120,
  sprintPct: 140.5,
  accPct: 110,
  decPct: 90,
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

function snapshotRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    week_id: WEEK_ID,
    player_id: PLAYER_ID,
    td_best: 800,
    hsr_best: 328,
    sprint_best: 100,
    acc_best: 40,
    dec_best: 35,
    powerbi_player_name: "Old Exact Name",
    source_method: "single-match best",
    created_at: "2026-01-01T00:00:00Z",
    created_by: ADMIN.id,
    ...overrides,
  };
}

function targetRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    week_id: WEEK_ID,
    player_id: PLAYER_ID,
    td_pct: 140,
    hsr_pct: 120,
    sprint_pct: 140.5,
    acc_pct: 110,
    dec_pct: 90,
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    created_by: ADMIN.id,
    updated_by: ADMIN.id,
    ...overrides,
  };
}

describe("weekly targets auth", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    rpcMock.mockReset();
    getPlayerMapping.mockReset();
    getMatchBestGps.mockReset();
  });

  it("rejects unauthenticated / staff / player", async () => {
    getAppUser.mockResolvedValue(null);
    await expect(
      createPlannerWeeklyTarget({ weekId: WEEK_ID, playerId: PLAYER_ID, ...PCT })
    ).resolves.toMatchObject({ ok: false, error: { code: "unauthorized" } });

    getAppUser.mockResolvedValue(STAFF);
    await expect(
      createPlannerWeeklyTarget({ weekId: WEEK_ID, playerId: PLAYER_ID, ...PCT })
    ).resolves.toMatchObject({ ok: false, error: { code: "unauthorized" } });

    getAppUser.mockResolvedValue(PLAYER);
    await expect(
      createPlannerWeeklyTarget({ weekId: WEEK_ID, playerId: PLAYER_ID, ...PCT })
    ).resolves.toMatchObject({ ok: false, error: { code: "unauthorized" } });
  });
});

describe("createPlannerWeeklyTarget — existing snapshot path", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    rpcMock.mockReset();
    getPlayerMapping.mockReset();
    getMatchBestGps.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("reuses frozen snapshot; does not call Match Best or mapping; preserves Old Exact Name", async () => {
    const week = chain({ data: { id: WEEK_ID }, error: null }, { maybeSingle: true });
    const profile = chain(
      { data: { id: PLAYER_ID, role: "player" }, error: null },
      { maybeSingle: true }
    );
    const snap = chain(
      { data: snapshotRow({ powerbi_player_name: "Old Exact Name" }), error: null },
      { maybeSingle: true }
    );
    const existingTarget = chain({ data: null, error: null }, { maybeSingle: true });
    const insert = chain({ data: targetRow(), error: null }, { single: true });
    const names = chain(
      {
        data: [{ id: PLAYER_ID, full_name: "Player One", email: "p@t.com" }],
        error: null,
      }
    );

    let profileCalls = 0;
    let targetCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks") return week;
      if (table === "profiles") {
        profileCalls += 1;
        return profileCalls === 1 ? profile : names;
      }
      if (table === "planner_match_best_snapshots") return snap;
      if (table === "planner_weekly_targets") {
        targetCalls += 1;
        return targetCalls === 1 ? existingTarget : insert;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await createPlannerWeeklyTarget({
      weekId: WEEK_ID,
      playerId: PLAYER_ID,
      ...PCT,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.snapshotCreated).toBe(false);
    expect(result.data.powerBiPlayerName).toBe("Old Exact Name");
    expect(result.data.totalDistance).toBe(1120);
    expect(result.data.hsr).toBe(393.6);
    expect(result.data.sprint).toBe(140.5);
    expect(getMatchBestGps).not.toHaveBeenCalled();
    expect(getPlayerMapping).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("maps duplicate target insert to weekly_target_already_exists", async () => {
    let profileCalls = 0;
    let targetCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks")
        return chain({ data: { id: WEEK_ID }, error: null }, { maybeSingle: true });
      if (table === "profiles") {
        profileCalls += 1;
        return profileCalls === 1
          ? chain(
              { data: { id: PLAYER_ID, role: "player" }, error: null },
              { maybeSingle: true }
            )
          : chain({ data: [], error: null });
      }
      if (table === "planner_match_best_snapshots")
        return chain({ data: snapshotRow(), error: null }, { maybeSingle: true });
      if (table === "planner_weekly_targets") {
        targetCalls += 1;
        if (targetCalls === 1)
          return chain({ data: null, error: null }, { maybeSingle: true });
        return chain(
          {
            data: null,
            error: {
              code: "23505",
              message:
                'duplicate key value violates unique constraint "planner_weekly_targets_pkey"',
            },
          },
          { single: true }
        );
      }
      throw new Error(table);
    });

    await expect(
      createPlannerWeeklyTarget({ weekId: WEEK_ID, playerId: PLAYER_ID, ...PCT })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "weekly_target_already_exists" },
    });
  });
});

describe("createPlannerWeeklyTarget — new snapshot path", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    rpcMock.mockReset();
    getPlayerMapping.mockReset();
    getMatchBestGps.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  function setupNoSnapshotHappyPath() {
    let profileCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks")
        return chain({ data: { id: WEEK_ID }, error: null }, { maybeSingle: true });
      if (table === "profiles") {
        profileCalls += 1;
        return profileCalls === 1
          ? chain(
              { data: { id: PLAYER_ID, role: "player" }, error: null },
              { maybeSingle: true }
            )
          : chain({
              data: [{ id: PLAYER_ID, full_name: "Player One", email: null }],
              error: null,
            });
      }
      if (table === "planner_match_best_snapshots")
        return chain({ data: null, error: null }, { maybeSingle: true });
      throw new Error(table);
    });

    getPlayerMapping.mockResolvedValue({
      ok: true,
      data: {
        id: "m1",
        playerId: PLAYER_ID,
        provider: "powerbi",
        externalPlayerName: "Exact Mapped Name",
        createdAt: "t",
        updatedAt: "t",
        playerDisplayName: "Player One",
      },
    });
    getMatchBestGps.mockResolvedValue({
      ok: true,
      data: {
        tdBest: 800,
        hsrBest: 328,
        sprintBest: 100,
        accBest: 40,
        decBest: 35,
      },
    });
    rpcMock.mockResolvedValue({
      data: {
        snapshot: snapshotRow({ powerbi_player_name: "Exact Mapped Name" }),
        weekly_target: targetRow(),
      },
      error: null,
    });
  }

  it("calls mapping once, Match Best once with exact name, RPC once with raw values", async () => {
    setupNoSnapshotHappyPath();

    const result = await createPlannerWeeklyTarget({
      weekId: WEEK_ID,
      playerId: PLAYER_ID,
      ...PCT,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.snapshotCreated).toBe(true);
    expect(result.data.powerBiPlayerName).toBe("Exact Mapped Name");
    expect(getPlayerMapping).toHaveBeenCalledTimes(1);
    expect(getPlayerMapping).toHaveBeenCalledWith(PLAYER_ID);
    expect(getMatchBestGps).toHaveBeenCalledTimes(1);
    expect(getMatchBestGps).toHaveBeenCalledWith({
      playerName: "Exact Mapped Name",
    });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith(
      "planner_create_snapshot_and_weekly_target",
      expect.objectContaining({
        p_week_id: WEEK_ID,
        p_player_id: PLAYER_ID,
        p_powerbi_player_name: "Exact Mapped Name",
        p_td_best: 800,
        p_hsr_best: 328,
        p_sprint_best: 100,
        p_acc_best: 40,
        p_dec_best: 35,
        p_td_pct: 140,
        p_hsr_pct: 120,
        p_sprint_pct: 140.5,
        p_acc_pct: 110,
        p_dec_pct: 90,
      })
    );
  });

  it("maps mapping missing / Match Best failures / incomplete bests", async () => {
    const baseNoSnap = () => {
      fromMock.mockImplementation((table: string) => {
        if (table === "planner_weeks")
          return chain({ data: { id: WEEK_ID }, error: null }, { maybeSingle: true });
        if (table === "profiles")
          return chain(
            { data: { id: PLAYER_ID, role: "player" }, error: null },
            { maybeSingle: true }
          );
        if (table === "planner_match_best_snapshots")
          return chain({ data: null, error: null }, { maybeSingle: true });
        throw new Error(table);
      });
    };

    baseNoSnap();
    getPlayerMapping.mockResolvedValue({ ok: true, data: null });
    await expect(
      createPlannerWeeklyTarget({ weekId: WEEK_ID, playerId: PLAYER_ID, ...PCT })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "mapping_not_found" },
    });
    expect(getMatchBestGps).not.toHaveBeenCalled();

    baseNoSnap();
    getPlayerMapping.mockResolvedValue({
      ok: true,
      data: {
        id: "m1",
        playerId: PLAYER_ID,
        provider: "powerbi",
        externalPlayerName: "Exact Mapped Name",
        createdAt: "t",
        updatedAt: "t",
        playerDisplayName: "P",
      },
    });
    getMatchBestGps.mockResolvedValue({
      ok: false,
      error: { code: "not_found", message: "missing" },
    });
    await expect(
      createPlannerWeeklyTarget({ weekId: WEEK_ID, playerId: PLAYER_ID, ...PCT })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "match_best_not_found" },
    });

    getMatchBestGps.mockResolvedValue({
      ok: false,
      error: { code: "ambiguous", message: "dup" },
    });
    await expect(
      createPlannerWeeklyTarget({ weekId: WEEK_ID, playerId: PLAYER_ID, ...PCT })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "match_best_ambiguous" },
    });

    getMatchBestGps.mockResolvedValue({
      ok: false,
      error: { code: "token_error", message: "fail" },
    });
    await expect(
      createPlannerWeeklyTarget({ weekId: WEEK_ID, playerId: PLAYER_ID, ...PCT })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "powerbi_error" },
    });

    getMatchBestGps.mockResolvedValue({
      ok: true,
      data: {
        tdBest: 800,
        hsrBest: null,
        sprintBest: 1,
        accBest: 1,
        decBest: 1,
      },
    });
    await expect(
      createPlannerWeeklyTarget({ weekId: WEEK_ID, playerId: PLAYER_ID, ...PCT })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "match_best_incomplete" },
    });
    expect(rpcMock).not.toHaveBeenCalled();

    getMatchBestGps.mockResolvedValue({
      ok: true,
      data: {
        tdBest: -1,
        hsrBest: 1,
        sprintBest: 1,
        accBest: 1,
        decBest: 1,
      },
    });
    await expect(
      createPlannerWeeklyTarget({ weekId: WEEK_ID, playerId: PLAYER_ID, ...PCT })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "match_best_incomplete" },
    });
  });

  it("maps RPC unique conflict and mapping_changed without retry", async () => {
    setupNoSnapshotHappyPath();
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message:
          "planner_create_snapshot_and_weekly_target: snapshot or weekly target already exists for this week/player",
      },
    });
    await expect(
      createPlannerWeeklyTarget({ weekId: WEEK_ID, playerId: PLAYER_ID, ...PCT })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "weekly_target_already_exists" },
    });
    expect(rpcMock).toHaveBeenCalledTimes(1);

    setupNoSnapshotHappyPath();
    rpcMock.mockClear();
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "22023",
        message:
          "planner_create_snapshot_and_weekly_target: no exact powerbi mapping for player_id and powerbi_player_name",
      },
    });
    await expect(
      createPlannerWeeklyTarget({ weekId: WEEK_ID, playerId: PLAYER_ID, ...PCT })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "mapping_changed" },
    });
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });
});

describe("weekly target update / delete / recreate", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    rpcMock.mockReset();
    getPlayerMapping.mockReset();
    getMatchBestGps.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("updates percentages only; recalculates derived; no Power BI/mapping", async () => {
    let profileCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_match_best_snapshots")
        return chain(
          { data: snapshotRow({ powerbi_player_name: "Frozen Name" }), error: null },
          { maybeSingle: true }
        );
      if (table === "planner_weekly_targets")
        return chain(
          {
            data: targetRow({
              td_pct: 400,
              hsr_pct: 140.5,
              sprint_pct: 100,
              acc_pct: 100,
              dec_pct: 100,
            }),
            error: null,
          },
          { maybeSingle: true }
        );
      if (table === "profiles") {
        profileCalls += 1;
        return chain({
          data: [{ id: PLAYER_ID, full_name: "Player One", email: null }],
          error: null,
        });
      }
      throw new Error(table);
    });

    const result = await updatePlannerWeeklyTarget({
      weekId: WEEK_ID,
      playerId: PLAYER_ID,
      tdPct: 400,
      hsrPct: 140.5,
      sprintPct: 100,
      accPct: 100,
      decPct: 100,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.powerBiPlayerName).toBe("Frozen Name");
    expect(result.data.tdPct).toBe(400);
    expect(result.data.totalDistance).toBe(3200);
    expect(result.data.hsr).toBe(460.84);
    expect(getMatchBestGps).not.toHaveBeenCalled();
    expect(getPlayerMapping).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
    void profileCalls;
  });

  it("rejects invalid percentages on update", async () => {
    for (const bad of [-1, NaN, Infinity] as number[]) {
      await expect(
        updatePlannerWeeklyTarget({
          weekId: WEEK_ID,
          playerId: PLAYER_ID,
          tdPct: bad,
          hsrPct: 100,
          sprintPct: 100,
          accPct: 100,
          decPct: 100,
        })
      ).resolves.toMatchObject({
        ok: false,
        error: { code: "invalid_percentage" },
      });
    }
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("delete requires confirm and never deletes snapshot; recreate reuses snapshot", async () => {
    await expect(
      deletePlannerWeeklyTarget({
        weekId: WEEK_ID,
        playerId: PLAYER_ID,
        confirm: false as unknown as true,
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "confirmation_required" },
    });

    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weekly_targets")
        return chain(
          { data: { week_id: WEEK_ID, player_id: PLAYER_ID }, error: null },
          { maybeSingle: true }
        );
      throw new Error(`unexpected delete table ${table}`);
    });

    const del = await deletePlannerWeeklyTarget({
      weekId: WEEK_ID,
      playerId: PLAYER_ID,
      confirm: true,
    });
    expect(del.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("planner_weekly_targets");
    expect(fromMock).not.toHaveBeenCalledWith("planner_match_best_snapshots");

    // Recreate: existing snapshot path
    let profileCalls = 0;
    let targetCalls = 0;
    fromMock.mockReset();
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks")
        return chain({ data: { id: WEEK_ID }, error: null }, { maybeSingle: true });
      if (table === "profiles") {
        profileCalls += 1;
        return profileCalls === 1
          ? chain(
              { data: { id: PLAYER_ID, role: "player" }, error: null },
              { maybeSingle: true }
            )
          : chain({
              data: [{ id: PLAYER_ID, full_name: "Player One", email: null }],
              error: null,
            });
      }
      if (table === "planner_match_best_snapshots")
        return chain(
          { data: snapshotRow({ powerbi_player_name: "Old Exact Name" }), error: null },
          { maybeSingle: true }
        );
      if (table === "planner_weekly_targets") {
        targetCalls += 1;
        return targetCalls === 1
          ? chain({ data: null, error: null }, { maybeSingle: true })
          : chain({ data: targetRow(), error: null }, { single: true });
      }
      throw new Error(table);
    });
    getPlayerMapping.mockResolvedValue({
      ok: true,
      data: {
        id: "m1",
        playerId: PLAYER_ID,
        provider: "powerbi",
        externalPlayerName: "New Exact Name",
        createdAt: "t",
        updatedAt: "t",
        playerDisplayName: "P",
      },
    });

    const recreate = await createPlannerWeeklyTarget({
      weekId: WEEK_ID,
      playerId: PLAYER_ID,
      ...PCT,
    });
    expect(recreate.ok).toBe(true);
    if (!recreate.ok) return;
    expect(recreate.data.snapshotCreated).toBe(false);
    expect(recreate.data.powerBiPlayerName).toBe("Old Exact Name");
    expect(getMatchBestGps).not.toHaveBeenCalled();
    expect(getPlayerMapping).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("weekly target reads", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("get/list return identity, %, frozen snapshot, derived absolutes", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weekly_targets")
        return chain({ data: targetRow(), error: null }, { maybeSingle: true });
      if (table === "planner_match_best_snapshots")
        return chain({ data: snapshotRow(), error: null }, { maybeSingle: true });
      if (table === "profiles")
        return chain({
          data: [{ id: PLAYER_ID, full_name: "Player One", email: null }],
          error: null,
        });
      throw new Error(table);
    });

    const one = await getPlannerWeeklyTarget(WEEK_ID, PLAYER_ID);
    expect(one.ok).toBe(true);
    if (!one.ok || !one.data) return;
    expect(one.data.playerDisplayName).toBe("Player One");
    expect(one.data.powerBiPlayerName).toBe("Old Exact Name");
    expect(one.data.totalDistance).toBe(1120);

    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks")
        return chain({ data: { id: WEEK_ID }, error: null }, { maybeSingle: true });
      if (table === "planner_weekly_targets")
        return chain({ data: [targetRow()], error: null });
      if (table === "planner_match_best_snapshots")
        return chain({ data: [snapshotRow()], error: null });
      if (table === "profiles")
        return chain({
          data: [{ id: PLAYER_ID, full_name: "Player One", email: null }],
          error: null,
        });
      throw new Error(table);
    });

    const list = await listPlannerWeeklyTargets(WEEK_ID);
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data).toHaveLength(1);
    expect(list.data[0].hsr).toBe(393.6);
  });

  it("getPlannerMatchBestSnapshot is admin-only read", async () => {
    getAppUser.mockResolvedValue(STAFF);
    await expect(
      getPlannerMatchBestSnapshot(WEEK_ID, PLAYER_ID)
    ).resolves.toMatchObject({ ok: false, error: { code: "unauthorized" } });

    getAppUser.mockResolvedValue(ADMIN);
    fromMock.mockImplementation(() =>
      chain({ data: snapshotRow(), error: null }, { maybeSingle: true })
    );
    const snap = await getPlannerMatchBestSnapshot(WEEK_ID, PLAYER_ID);
    expect(snap.ok).toBe(true);
    if (!snap.ok || !snap.data) return;
    expect(snap.data.sourceMethod).toBe("single-match best");
  });
});
