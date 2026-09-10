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

const { syncWeekSquadSnapshotsAfterStatusSave } = vi.hoisted(() => ({
  syncWeekSquadSnapshotsAfterStatusSave: vi.fn(
    async (): Promise<string | undefined> => undefined
  ),
}));
vi.mock("@/lib/gpsPlanner/weekSquadSnapshots.server", () => ({
  syncWeekSquadSnapshotsAfterStatusSave,
  weekStatusFreezesSquadSnapshots: (status: string) =>
    status === "active" || status === "closed",
}));

import {
  createPlannerWeek,
  deletePlannerWeek,
  listPlannerWeeks,
  updatePlannerWeek,
} from "@/lib/gpsPlanner/weeks.server";

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
const WEEK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function chain(
  result: { data: unknown; error: unknown },
  opts?: { single?: boolean; maybeSingle?: boolean }
) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  for (const key of [
    "select",
    "eq",
    "order",
    "insert",
    "update",
    "delete",
  ]) {
    api[key] = vi.fn(self);
  }
  if (opts?.single) api.single = vi.fn().mockResolvedValue(result);
  else if (opts?.maybeSingle) api.maybeSingle = vi.fn().mockResolvedValue(result);
  else Object.assign(api, { then: (resolve: (v: unknown) => unknown) => resolve(result) });
  return api;
}

describe("planner weeks auth", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
  });

  it("rejects staff/unauthenticated", async () => {
    getAppUser.mockResolvedValue(null);
    await expect(listPlannerWeeks()).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    getAppUser.mockResolvedValue(STAFF);
    await expect(listPlannerWeeks()).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
  });
});

describe("planner weeks CRUD", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    syncWeekSquadSnapshotsAfterStatusSave.mockClear();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("creates a valid week and preserves YYYY-MM-DD", async () => {
    const insert = chain(
      {
        data: {
          id: WEEK_ID,
          powerbi_week_id: "W6",
          start_date: "2026-03-09",
          end_date: "2026-03-15",
          week_type: "overload",
          overload_focus: ["hsr"],
          status: "draft",
          created_by: ADMIN.id,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        error: null,
      },
      { single: true }
    );
    fromMock.mockReturnValue(insert);

    const result = await createPlannerWeek({
      powerBiWeekId: "  W6  ",
      startDate: "2026-03-09",
      endDate: "2026-03-15",
      weekType: "overload",
      overloadFocus: ["hsr"],
      status: "draft",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.startDate).toBe("2026-03-09");
    expect(result.data.powerbiWeekId).toBe("W6");
  });

  it("rejects invalid date range / non-overload focus / duplicate week", async () => {
    await expect(
      createPlannerWeek({
        powerBiWeekId: "W6",
        startDate: "2026-03-15",
        endDate: "2026-03-09",
        weekType: "deload",
      })
    ).resolves.toMatchObject({ ok: false, error: { code: "invalid_date_range" } });

    await expect(
      createPlannerWeek({
        powerBiWeekId: "W6",
        startDate: "2026-03-09",
        endDate: "2026-03-15",
        weekType: "deload",
        overloadFocus: ["td"],
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid_overload_focus" },
    });

    fromMock.mockReturnValue(
      chain(
        {
          data: null,
          error: {
            message:
              'duplicate key value violates unique constraint "planner_weeks_powerbi_week_id_start_date_key"',
          },
        },
        { single: true }
      )
    );
    await expect(
      createPlannerWeek({
        powerBiWeekId: "W6",
        startDate: "2026-03-09",
        endDate: "2026-03-15",
        weekType: "maintaining",
      })
    ).resolves.toMatchObject({ ok: false, error: { code: "duplicate_week" } });
  });

  it("accepts overload with empty focus", async () => {
    fromMock.mockReturnValue(
      chain(
        {
          data: {
            id: WEEK_ID,
            powerbi_week_id: "W6",
            start_date: "2026-03-09",
            end_date: "2026-03-15",
            week_type: "overload",
            overload_focus: [],
            status: "draft",
            created_by: ADMIN.id,
            created_at: "a",
            updated_at: "a",
          },
          error: null,
        },
        { single: true }
      )
    );
    await expect(
      createPlannerWeek({
        powerBiWeekId: "W6",
        startDate: "2026-03-09",
        endDate: "2026-03-15",
        weekType: "overload",
        overloadFocus: [],
      })
    ).resolves.toMatchObject({ ok: true });
  });

  it("rejects week range conflict with existing days", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_week_days") {
        return chain({ data: [{ date: "2026-03-09" }], error: null });
      }
      return chain({ data: null, error: null }, { maybeSingle: true });
    });
    await expect(
      updatePlannerWeek({
        weekId: WEEK_ID,
        powerBiWeekId: "W6",
        startDate: "2026-03-10",
        endDate: "2026-03-15",
        weekType: "maintaining",
        status: "draft",
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "week_range_conflict" },
    });
    expect(syncWeekSquadSnapshotsAfterStatusSave).not.toHaveBeenCalled();
  });

  it("does not freeze snapshots when a week is saved as draft", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_week_days") {
        return chain({ data: [], error: null });
      }
      return chain(
        {
          data: {
            id: WEEK_ID,
            powerbi_week_id: "W6",
            start_date: "2026-03-09",
            end_date: "2026-03-15",
            week_type: "maintaining",
            overload_focus: [],
            status: "draft",
            created_by: ADMIN.id,
            created_at: "a",
            updated_at: "a",
          },
          error: null,
        },
        { maybeSingle: true }
      );
    });
    await expect(
      updatePlannerWeek({
        weekId: WEEK_ID,
        powerBiWeekId: "W6",
        startDate: "2026-03-09",
        endDate: "2026-03-15",
        weekType: "maintaining",
        status: "draft",
      })
    ).resolves.toMatchObject({ ok: true });
    expect(syncWeekSquadSnapshotsAfterStatusSave).not.toHaveBeenCalled();
  });

  it("freezes missing week-squad snapshots when a week is saved as active", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_week_days") {
        return chain({ data: [], error: null });
      }
      return chain(
        {
          data: {
            id: WEEK_ID,
            powerbi_week_id: "W6",
            start_date: "2026-03-09",
            end_date: "2026-03-15",
            week_type: "maintaining",
            overload_focus: [],
            status: "active",
            created_by: ADMIN.id,
            created_at: "a",
            updated_at: "a",
          },
          error: null,
        },
        { maybeSingle: true }
      );
    });
    await expect(
      updatePlannerWeek({
        weekId: WEEK_ID,
        powerBiWeekId: "W6",
        startDate: "2026-03-09",
        endDate: "2026-03-15",
        weekType: "maintaining",
        status: "active",
      })
    ).resolves.toMatchObject({ ok: true });
    expect(syncWeekSquadSnapshotsAfterStatusSave).toHaveBeenCalledWith(
      WEEK_ID,
      "active"
    );
  });

  it("attaches mapped snapshot warning on successful active week save", async () => {
    const warning =
      "Week saved, but Match Best snapshots are incomplete for mapped players: Player One. Fix the Match Best data, then save the week or squad again.";
    syncWeekSquadSnapshotsAfterStatusSave.mockResolvedValueOnce(warning);
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_week_days") {
        return chain({ data: [], error: null });
      }
      return chain(
        {
          data: {
            id: WEEK_ID,
            powerbi_week_id: "W6",
            start_date: "2026-03-09",
            end_date: "2026-03-15",
            week_type: "maintaining",
            overload_focus: [],
            status: "active",
            created_by: ADMIN.id,
            created_at: "a",
            updated_at: "a",
          },
          error: null,
        },
        { maybeSingle: true }
      );
    });
    const result = await updatePlannerWeek({
      weekId: WEEK_ID,
      powerBiWeekId: "W6",
      startDate: "2026-03-09",
      endDate: "2026-03-15",
      weekType: "maintaining",
      status: "active",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.snapshotWarning).toBe(warning);
  });

  it("requires explicit confirm for delete", async () => {
    await expect(
      deletePlannerWeek({ weekId: WEEK_ID, confirm: false as unknown as true })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "confirmation_required" },
    });

    const del = chain(
      { data: { id: WEEK_ID }, error: null },
      { maybeSingle: true }
    );
    fromMock.mockReturnValue(del);
    await expect(
      deletePlannerWeek({ weekId: WEEK_ID, confirm: true })
    ).resolves.toEqual({ ok: true, data: { weekId: WEEK_ID } });
    expect(del.delete).toHaveBeenCalled();
  });
});
