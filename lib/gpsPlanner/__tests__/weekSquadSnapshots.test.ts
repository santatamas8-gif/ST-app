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

const getPlayerMapping = vi.fn();
vi.mock("@/lib/gpsPlanner/playerMappings.server", () => ({
  getPlayerMapping: (...args: unknown[]) => getPlayerMapping(...args),
}));

const getMatchBestGps = vi.fn();
vi.mock("@/lib/powerbi/queries/matchBest.server", () => ({
  getMatchBestGps: (...args: unknown[]) => getMatchBestGps(...args),
}));

import {
  buildSnapshotSaveWarning,
  ensureWeekSquadMatchBestSnapshots,
  syncWeekSquadMatchBestSnapshotsIfActivated,
  weekStatusFreezesSquadSnapshots,
} from "@/lib/gpsPlanner/weekSquadSnapshots.server";
import { listPlannerWeekPlayers } from "@/lib/gpsPlanner/weekPlayers.server";

const ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "a@t.com",
  role: "admin" as const,
};

const WEEK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_WEEK = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const P1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const P2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const P3 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const P_OUTSIDER = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const BEST = {
  tdBest: 10000,
  hsrBest: 800,
  sprintBest: 200,
  accBest: 40,
  decBest: 35,
};

function mapping(name: string) {
  return {
    ok: true as const,
    data: { externalPlayerName: name },
  };
}

describe("weekStatusFreezesSquadSnapshots", () => {
  it("freezes only active and closed weeks", () => {
    expect(weekStatusFreezesSquadSnapshots("draft")).toBe(false);
    expect(weekStatusFreezesSquadSnapshots("active")).toBe(true);
    expect(weekStatusFreezesSquadSnapshots("closed")).toBe(true);
    expect(weekStatusFreezesSquadSnapshots(null)).toBe(false);
  });
});

describe("ensureWeekSquadMatchBestSnapshots", () => {
  const snapshotInserts: Record<string, unknown>[] = [];
  const snapshotUpdates: unknown[] = [];
  const snapshotDeletes: unknown[] = [];
  const targetTouches: string[] = [];
  const weekIdsQueried: string[] = [];

  function chain(result: { data: unknown; error: unknown }) {
    const api: Record<string, unknown> = {};
    const self = () => api;
    api.select = vi.fn(self);
    api.eq = vi.fn((column: string, value: unknown) => {
      if (column === "week_id" && typeof value === "string") {
        weekIdsQueried.push(value);
      }
      return api;
    });
    api.in = vi.fn(self);
    api.insert = vi.fn((row: Record<string, unknown>) => {
      snapshotInserts.push(row);
      return {
        then: (resolve: (v: unknown) => unknown) =>
          resolve({ data: row, error: null }),
      };
    });
    api.update = vi.fn((row: unknown) => {
      snapshotUpdates.push(row);
      return {
        then: (resolve: (v: unknown) => unknown) =>
          resolve({ data: null, error: { message: "immutable" } }),
      };
    });
    api.delete = vi.fn(() => {
      snapshotDeletes.push(true);
      return {
        then: (resolve: (v: unknown) => unknown) =>
          resolve({ data: null, error: { message: "no delete" } }),
      };
    });
    api.then = (resolve: (v: unknown) => unknown) => resolve(result);
    return api;
  }

  function mockTables(input: {
    squad: string[];
    existing: string[];
    insertError?: { message: string; code: string };
  }) {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weekly_targets" || table === "planner_daily_targets") {
        targetTouches.push(table);
        throw new Error(`${table} must not be touched`);
      }
      if (table === "profiles") {
        return chain({
          data: [
            { id: P1, full_name: "Player One", email: null },
            { id: P2, full_name: "Player Two", email: null },
            { id: P3, full_name: "Player Three", email: null },
          ],
          error: null,
        });
      }
      if (table === "planner_week_players") {
        return chain({
          data: input.squad.map((player_id) => ({ player_id })),
          error: null,
        });
      }
      if (table === "planner_match_best_snapshots") {
        const api = chain({
          data: input.existing.map((player_id) => ({ player_id })),
          error: null,
        });
        if (input.insertError) {
          api.insert = vi.fn(() => ({
            then: (resolve: (v: unknown) => unknown) =>
              resolve({ data: null, error: input.insertError }),
          }));
        }
        return api;
      }
      if (table === "planner_weeks") {
        throw new Error("ensure must not list historical weeks");
      }
      throw new Error(`unexpected table ${table}`);
    });
  }

  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    getPlayerMapping.mockReset();
    getMatchBestGps.mockReset();
    snapshotInserts.length = 0;
    snapshotUpdates.length = 0;
    snapshotDeletes.length = 0;
    targetTouches.length = 0;
    weekIdsQueried.length = 0;
    getAppUser.mockResolvedValue(ADMIN);
    getPlayerMapping.mockImplementation(async (playerId: string) =>
      mapping(`PBI ${playerId.slice(0, 8)}`)
    );
    getMatchBestGps.mockResolvedValue({ ok: true, data: BEST });
  });

  it("creates a snapshot for every week-squad member without a Weekly Target", async () => {
    mockTables({ squad: [P1, P2], existing: [] });
    const result = await ensureWeekSquadMatchBestSnapshots(WEEK_ID, "active");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.createdPlayerIds.sort()).toEqual([P1, P2].sort());
    expect(snapshotInserts).toHaveLength(2);
    expect(snapshotInserts.map((row) => row.player_id).sort()).toEqual(
      [P1, P2].sort()
    );
    expect(
      snapshotInserts.every((row) => row.week_id === WEEK_ID)
    ).toBe(true);
    expect(targetTouches).toEqual([]);
  });

  it("does not snapshot a player who is not in the week squad", async () => {
    mockTables({ squad: [P1], existing: [] });
    getPlayerMapping.mockImplementation(async (playerId: string) => {
      if (playerId === P_OUTSIDER) throw new Error("outsider mapping");
      return mapping("Carl Davordzie");
    });
    const result = await ensureWeekSquadMatchBestSnapshots(WEEK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.createdPlayerIds).toEqual([P1]);
    expect(getPlayerMapping).toHaveBeenCalledTimes(1);
    expect(getPlayerMapping).toHaveBeenCalledWith(P1);
    expect(getMatchBestGps).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: a second run does not insert a second row", async () => {
    mockTables({ squad: [P1], existing: [P1] });
    const result = await ensureWeekSquadMatchBestSnapshots(WEEK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.createdPlayerIds).toEqual([]);
    expect(result.data.skippedExistingPlayerIds).toEqual([P1]);
    expect(snapshotInserts).toHaveLength(0);
    expect(getMatchBestGps).not.toHaveBeenCalled();
  });

  it("does not change existing snapshot values", async () => {
    mockTables({ squad: [P1], existing: [P1] });
    getMatchBestGps.mockResolvedValue({
      ok: true,
      data: { ...BEST, tdBest: 1 },
    });
    await ensureWeekSquadMatchBestSnapshots(WEEK_ID);
    expect(snapshotInserts).toHaveLength(0);
    expect(snapshotUpdates).toHaveLength(0);
    expect(snapshotDeletes).toHaveLength(0);
  });

  it("later-added squad members only get their own new snapshot", async () => {
    mockTables({ squad: [P1, P2], existing: [P1] });
    const result = await ensureWeekSquadMatchBestSnapshots(WEEK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.skippedExistingPlayerIds).toEqual([P1]);
    expect(result.data.createdPlayerIds).toEqual([P2]);
    expect(snapshotInserts).toHaveLength(1);
    expect(snapshotInserts[0]?.player_id).toBe(P2);
    expect(getMatchBestGps).toHaveBeenCalledTimes(1);
  });

  it("keeps the historical snapshot of a removed squad member", async () => {
    mockTables({ squad: [P1], existing: [P1, P2] });
    const result = await ensureWeekSquadMatchBestSnapshots(WEEK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.createdPlayerIds).toEqual([]);
    expect(snapshotDeletes).toHaveLength(0);
    expect(snapshotUpdates).toHaveLength(0);
    expect(snapshotInserts).toHaveLength(0);
  });

  it("skips unmapped squad members without snapshot, issue, or Match Best lookup", async () => {
    mockTables({ squad: [P1, P2], existing: [] });
    getPlayerMapping.mockImplementation(async (playerId: string) => {
      if (playerId === P1) return { ok: true, data: null };
      return mapping("Player Two");
    });
    const result = await ensureWeekSquadMatchBestSnapshots(WEEK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.createdPlayerIds).toEqual([P2]);
    expect(result.data.skippedUnmappedPlayerIds).toEqual([P1]);
    expect(result.data.issues).toEqual([]);
    expect(getMatchBestGps).toHaveBeenCalledTimes(1);
    expect(getMatchBestGps).toHaveBeenCalledWith({ playerName: "Player Two" });
    expect(snapshotInserts).toHaveLength(1);
    expect(snapshotInserts[0]?.player_id).toBe(P2);
    const warning = await buildSnapshotSaveWarning(result, "week");
    expect(warning).toBeUndefined();
  });

  it("continues when several squad members are unmapped", async () => {
    mockTables({ squad: [P1, P2, P3], existing: [] });
    getPlayerMapping.mockImplementation(async (playerId: string) => {
      if (playerId === P1 || playerId === P2) return { ok: true, data: null };
      return mapping("Player Three");
    });
    const result = await ensureWeekSquadMatchBestSnapshots(WEEK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.skippedUnmappedPlayerIds.sort()).toEqual([P1, P2].sort());
    expect(result.data.createdPlayerIds).toEqual([P3]);
    expect(result.data.issues).toEqual([]);
  });

  it("creates a snapshot after an unmapped player later receives a mapping", async () => {
    mockTables({ squad: [P1], existing: [] });
    getPlayerMapping.mockResolvedValueOnce({ ok: true, data: null });
    const first = await ensureWeekSquadMatchBestSnapshots(WEEK_ID);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.skippedUnmappedPlayerIds).toEqual([P1]);
    expect(snapshotInserts).toHaveLength(0);

    getPlayerMapping.mockResolvedValueOnce(mapping("Carl Davordzie"));
    const second = await ensureWeekSquadMatchBestSnapshots(WEEK_ID);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.createdPlayerIds).toEqual([P1]);
    expect(snapshotInserts).toHaveLength(1);
    expect(snapshotInserts[0]?.powerbi_player_name).toBe("Carl Davordzie");
  });

  it("records missing Match Best without a zero fallback", async () => {
    mockTables({ squad: [P1], existing: [] });
    getMatchBestGps.mockResolvedValue({
      ok: false,
      error: { code: "not_found", message: "none" },
    });
    const result = await ensureWeekSquadMatchBestSnapshots(WEEK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.createdPlayerIds).toEqual([]);
    expect(result.data.issues[0]?.code).toBe("match_best_not_found");
    expect(snapshotInserts).toHaveLength(0);
    const warning = await buildSnapshotSaveWarning(result, "week");
    expect(warning).toBe(
      "Week saved, but Match Best snapshots are incomplete for mapped players: Player One. Fix the Match Best data, then save the week or squad again."
    );
  });

  it("records ambiguous Match Best without summing or picking one row", async () => {
    mockTables({ squad: [P1], existing: [] });
    getMatchBestGps.mockResolvedValue({
      ok: false,
      error: { code: "ambiguous", message: "dup" },
    });
    const result = await ensureWeekSquadMatchBestSnapshots(WEEK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.issues[0]?.code).toBe("match_best_ambiguous");
    expect(snapshotInserts).toHaveLength(0);
    const warning = await buildSnapshotSaveWarning(result, "squad");
    expect(warning).toBe(
      "Squad saved, but Match Best snapshots are incomplete for mapped players: Player One. Fix the Match Best data, then save the squad again."
    );
  });

  it("records incomplete Match Best metrics as a mapped issue", async () => {
    mockTables({ squad: [P1], existing: [] });
    getMatchBestGps.mockResolvedValue({
      ok: true,
      data: { ...BEST, tdBest: null },
    });
    const result = await ensureWeekSquadMatchBestSnapshots(WEEK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.issues[0]?.code).toBe("match_best_incomplete");
    expect(snapshotInserts).toHaveLength(0);
  });

  it("records a mapped technical Match Best failure as an issue", async () => {
    mockTables({ squad: [P1], existing: [] });
    getMatchBestGps.mockResolvedValue({
      ok: false,
      error: { code: "auth_failed", message: "token secret leaked" },
    });
    const result = await ensureWeekSquadMatchBestSnapshots(WEEK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.issues[0]?.code).toBe("powerbi_error");
    const warning = await buildSnapshotSaveWarning(result, "week");
    expect(warning).toContain("Player One");
    expect(warning).not.toMatch(/token secret leaked/i);
  });

  it("does not name unmapped players in the mapped-issue warning", async () => {
    mockTables({ squad: [P1, P2], existing: [] });
    getPlayerMapping.mockImplementation(async (playerId: string) => {
      if (playerId === P1) return { ok: true, data: null };
      return mapping("Mapped");
    });
    getMatchBestGps.mockResolvedValue({
      ok: false,
      error: { code: "not_found", message: "none" },
    });
    const result = await ensureWeekSquadMatchBestSnapshots(WEEK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.skippedUnmappedPlayerIds).toEqual([P1]);
    expect(result.data.issues.map((item) => item.playerId)).toEqual([P2]);
    const warning = await buildSnapshotSaveWarning(result, "week");
    expect(warning).toContain("Player Two");
    expect(warning).not.toContain("Player One");
  });

  it("uses a safe technical warning when snapshot sync itself fails", async () => {
    const warning = await buildSnapshotSaveWarning(
      {
        ok: false,
        error: { code: "database_error", message: "permission denied for table" },
      },
      "week"
    );
    expect(warning).toBe(
      "Week saved, but Match Best snapshots could not be completed. Try saving the week or squad again."
    );
    expect(warning).not.toMatch(/permission denied/i);
  });

  it("does not backfill other weeks", async () => {
    mockTables({ squad: [P1], existing: [] });
    await ensureWeekSquadMatchBestSnapshots(WEEK_ID);
    expect(weekIdsQueried.every((id) => id === WEEK_ID)).toBe(true);
    expect(weekIdsQueried).not.toContain(OTHER_WEEK);
  });

  it("does not create Weekly or Daily Targets", async () => {
    mockTables({ squad: [P1, P3], existing: [] });
    await ensureWeekSquadMatchBestSnapshots(WEEK_ID);
    expect(targetTouches).toEqual([]);
    expect(
      snapshotInserts.every(
        (row) =>
          !("td_pct" in row) &&
          !("hsr_pct" in row) &&
          row.source_method === "single-match best"
      )
    ).toBe(true);
  });

  it("uses the exact stored Power BI mapping name", async () => {
    mockTables({ squad: [P1], existing: [] });
    getPlayerMapping.mockResolvedValue(mapping("Nacho  Heras"));
    await ensureWeekSquadMatchBestSnapshots(WEEK_ID);
    expect(getMatchBestGps).toHaveBeenCalledWith({
      playerName: "Nacho  Heras",
    });
    expect(snapshotInserts[0]?.powerbi_player_name).toBe("Nacho  Heras");
  });
});

describe("syncWeekSquadMatchBestSnapshotsIfActivated", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    getPlayerMapping.mockReset();
    getMatchBestGps.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
    getMatchBestGps.mockResolvedValue({ ok: true, data: BEST });
    getPlayerMapping.mockResolvedValue(mapping("A"));
  });

  it("does not freeze a draft week", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table !== "planner_weeks") throw new Error(table);
      const api: Record<string, unknown> = {};
      const self = () => api;
      api.select = vi.fn(self);
      api.eq = vi.fn(self);
      api.maybeSingle = vi.fn().mockResolvedValue({
        data: { status: "draft" },
        error: null,
      });
      return api;
    });
    const result = await syncWeekSquadMatchBestSnapshotsIfActivated(WEEK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.ran).toBe(false);
    expect(getMatchBestGps).not.toHaveBeenCalled();
  });
});

describe("read-only week squad list", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    getMatchBestGps.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("does not create snapshots on page load", async () => {
    const touched: string[] = [];
    fromMock.mockImplementation((table: string) => {
      touched.push(table);
      const api: Record<string, unknown> = {};
      const self = () => api;
      api.select = vi.fn(self);
      api.eq = vi.fn(self);
      api.order = vi.fn(self);
      api.insert = vi.fn(() => {
        throw new Error("insert on list");
      });
      if (table === "planner_weeks") {
        api.maybeSingle = vi.fn().mockResolvedValue({
          data: { id: WEEK_ID },
          error: null,
        });
      } else {
        api.then = (resolve: (v: unknown) => unknown) =>
          resolve({ data: [{ player_id: P1 }], error: null });
      }
      return api;
    });
    await expect(listPlannerWeekPlayers(WEEK_ID)).resolves.toMatchObject({
      ok: true,
    });
    expect(touched).not.toContain("planner_match_best_snapshots");
    expect(getMatchBestGps).not.toHaveBeenCalled();
  });
});
