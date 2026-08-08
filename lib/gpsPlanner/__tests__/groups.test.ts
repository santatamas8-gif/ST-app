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

// Ensure Power BI modules are never pulled in by this phase
vi.mock("@/lib/powerbi/queries/playerNames.server", () => ({
  getPowerBiPlayerCandidates: vi.fn(() => {
    throw new Error("Power BI must not be called in Phase A groups");
  }),
}));
vi.mock("@/lib/powerbi/queries/matchBest.server", () => ({
  getMatchBestGps: vi.fn(() => {
    throw new Error("Power BI must not be called in Phase A groups");
  }),
}));
vi.mock("@/lib/powerbi/queries/trainingActual.server", () => ({
  getTrainingActualGps: vi.fn(() => {
    throw new Error("Power BI must not be called in Phase A groups");
  }),
}));

import {
  addPlannerGroupMember,
  createPlannerGroup,
  deletePlannerGroup,
  listPlannerGroups,
  removePlannerGroupMember,
  updatePlannerGroup,
} from "@/lib/gpsPlanner/groups.server";

const ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "a@t.com",
  role: "admin" as const,
};
const WEEK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GROUP_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PLAYER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

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

describe("planner groups", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("rejects unauthorized list", async () => {
    getAppUser.mockResolvedValue(null);
    await expect(listPlannerGroups(WEEK_ID)).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
  });

  it("creates/renames/deletes group without touching targets tables", async () => {
    const touched = new Set<string>();
    fromMock.mockImplementation((table: string) => {
      touched.add(table);
      if (table === "planner_weeks") {
        return chain(
          { data: { id: WEEK_ID }, error: null },
          { maybeSingle: true }
        );
      }
      if (table === "planner_groups") {
        return chain(
          {
            data: {
              id: GROUP_ID,
              week_id: WEEK_ID,
              name: "Starters",
              created_by: ADMIN.id,
              created_at: "a",
              updated_at: "a",
            },
            error: null,
          },
          { single: true, maybeSingle: true }
        );
      }
      return chain({ data: null, error: null });
    });

    await expect(
      createPlannerGroup({ weekId: WEEK_ID, name: "  Starters  " })
    ).resolves.toMatchObject({ ok: true, data: { name: "Starters" } });

    expect(touched.has("planner_match_best_snapshots")).toBe(false);
    expect(touched.has("planner_weekly_targets")).toBe(false);
    expect(touched.has("planner_daily_targets")).toBe(false);

    fromMock.mockImplementation((table: string) => {
      touched.add(table);
      return chain(
        {
          data: {
            id: GROUP_ID,
            week_id: WEEK_ID,
            name: "Non-Starters",
            created_by: ADMIN.id,
            created_at: "a",
            updated_at: "b",
          },
          error: null,
        },
        { maybeSingle: true }
      );
    });
    await expect(
      updatePlannerGroup({ groupId: GROUP_ID, name: "Non-Starters" })
    ).resolves.toMatchObject({ ok: true, data: { name: "Non-Starters" } });

    const del = chain(
      { data: { id: GROUP_ID }, error: null },
      { maybeSingle: true }
    );
    fromMock.mockReturnValue(del);
    await expect(deletePlannerGroup(GROUP_ID)).resolves.toEqual({
      ok: true,
      data: { groupId: GROUP_ID },
    });
  });

  it("maps duplicate group name", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks") {
        return chain(
          { data: { id: WEEK_ID }, error: null },
          { maybeSingle: true }
        );
      }
      return chain(
        {
          data: null,
          error: {
            message:
              'duplicate key value violates unique constraint "planner_groups_week_id_lower_trim_name_uidx"',
          },
        },
        { single: true }
      );
    });
    await expect(
      createPlannerGroup({ weekId: WEEK_ID, name: "Starters" })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "duplicate_group_name" },
    });
  });

  it("adds/removes members for players only; no Power BI / targets", async () => {
    const touched = new Set<string>();
    fromMock.mockImplementation((table: string) => {
      touched.add(table);
      if (table === "planner_groups") {
        return chain(
          {
            data: {
              id: GROUP_ID,
              week_id: WEEK_ID,
              name: "Starters",
              created_by: ADMIN.id,
              created_at: "a",
              updated_at: "a",
            },
            error: null,
          },
          { maybeSingle: true }
        );
      }
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: PLAYER_ID,
                  role: "player",
                  full_name: "Carl",
                  email: null,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "planner_group_members") {
        return chain(
          {
            data: {
              group_id: GROUP_ID,
              player_id: PLAYER_ID,
              added_at: "a",
              added_by: ADMIN.id,
            },
            error: null,
          },
          { single: true, maybeSingle: true }
        );
      }
      return chain({ data: null, error: null });
    });

    await expect(
      addPlannerGroupMember({ groupId: GROUP_ID, playerId: PLAYER_ID })
    ).resolves.toMatchObject({
      ok: true,
      data: { playerId: PLAYER_ID, groupId: GROUP_ID },
    });

    expect(touched.has("planner_match_best_snapshots")).toBe(false);
    expect(touched.has("planner_weekly_targets")).toBe(false);
    expect(touched.has("player_external_mappings")).toBe(false);

    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: PLAYER_ID, role: "staff" },
                error: null,
              }),
            }),
          }),
        };
      }
      return chain(
        {
          data: {
            id: GROUP_ID,
            week_id: WEEK_ID,
            name: "Starters",
            created_by: null,
            created_at: "a",
            updated_at: "a",
          },
          error: null,
        },
        { maybeSingle: true }
      );
    });
    await expect(
      addPlannerGroupMember({ groupId: GROUP_ID, playerId: PLAYER_ID })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "not_a_player" },
    });

    const rem = chain(
      { data: { group_id: GROUP_ID, player_id: PLAYER_ID }, error: null },
      { maybeSingle: true }
    );
    fromMock.mockReturnValue(rem);
    await expect(
      removePlannerGroupMember({ groupId: GROUP_ID, playerId: PLAYER_ID })
    ).resolves.toEqual({
      ok: true,
      data: { groupId: GROUP_ID, playerId: PLAYER_ID },
    });
  });
});
