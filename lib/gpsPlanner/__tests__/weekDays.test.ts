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

import {
  createPlannerWeekDay,
  deletePlannerWeekDay,
  listPlannerWeekDays,
  updatePlannerWeekDay,
} from "@/lib/gpsPlanner/weekDays.server";

const ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "a@t.com",
  role: "admin" as const,
};
const WEEK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DAY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function chain(
  result: { data: unknown; error: unknown },
  opts?: { single?: boolean; maybeSingle?: boolean }
) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  for (const key of ["select", "eq", "order", "insert", "update", "delete"]) {
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

describe("planner week days", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("lists days for week", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks") {
        return chain(
          {
            data: {
              id: WEEK_ID,
              start_date: "2026-03-09",
              end_date: "2026-03-15",
            },
            error: null,
          },
          { maybeSingle: true }
        );
      }
      return chain({
        data: [
          {
            id: DAY_ID,
            week_id: WEEK_ID,
            date: "2026-03-10",
            md_tag: "MD-1",
            display_order: 0,
            created_at: "a",
          },
        ],
        error: null,
      });
    });
    const result = await listPlannerWeekDays(WEEK_ID);
    expect(result.ok).toBe(true);
  });

  it("creates valid day and rejects outside week / bad order", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks") {
        return chain(
          {
            data: {
              id: WEEK_ID,
              start_date: "2026-03-09",
              end_date: "2026-03-15",
            },
            error: null,
          },
          { maybeSingle: true }
        );
      }
      return chain(
        {
          data: {
            id: DAY_ID,
            week_id: WEEK_ID,
            date: "2026-03-10",
            md_tag: "MD-1",
            display_order: 1,
            created_at: "a",
          },
          error: null,
        },
        { single: true }
      );
    });

    await expect(
      createPlannerWeekDay({
        weekId: WEEK_ID,
        date: "2026-03-10",
        mdTag: " MD-1 ",
        displayOrder: 1,
      })
    ).resolves.toMatchObject({
      ok: true,
      data: { date: "2026-03-10", mdTag: "MD-1" },
    });

    await expect(
      createPlannerWeekDay({
        weekId: WEEK_ID,
        date: "2026-03-01",
        mdTag: "MD-4",
        displayOrder: 2,
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "day_outside_week" },
    });

    await expect(
      createPlannerWeekDay({
        weekId: WEEK_ID,
        date: "2026-03-10",
        mdTag: "MD",
        displayOrder: -1,
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid_display_order" },
    });
  });

  it("maps duplicate date and allows same mdTag on different dates", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks") {
        return chain(
          {
            data: {
              id: WEEK_ID,
              start_date: "2026-03-09",
              end_date: "2026-03-15",
            },
            error: null,
          },
          { maybeSingle: true }
        );
      }
      return chain(
        {
          data: null,
          error: {
            message:
              'duplicate key value violates unique constraint "planner_week_days_week_id_date_key"',
          },
        },
        { single: true }
      );
    });
    await expect(
      createPlannerWeekDay({
        weekId: WEEK_ID,
        date: "2026-03-10",
        mdTag: "MD-1",
        displayOrder: 0,
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "duplicate_day_date" },
    });

    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks") {
        return chain(
          {
            data: {
              id: WEEK_ID,
              start_date: "2026-03-09",
              end_date: "2026-03-15",
            },
            error: null,
          },
          { maybeSingle: true }
        );
      }
      return chain(
        {
          data: {
            id: DAY_ID,
            week_id: WEEK_ID,
            date: "2026-03-11",
            md_tag: "MD-1",
            display_order: 3,
            created_at: "a",
          },
          error: null,
        },
        { single: true }
      );
    });
    await expect(
      createPlannerWeekDay({
        weekId: WEEK_ID,
        date: "2026-03-11",
        mdTag: "MD-1",
        displayOrder: 3,
      })
    ).resolves.toMatchObject({ ok: true, data: { mdTag: "MD-1" } });
  });

  it("update rejects outside week; delete requires confirm and does not reorder", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_week_days") {
        return chain(
          { data: { id: DAY_ID, week_id: WEEK_ID }, error: null },
          { maybeSingle: true }
        );
      }
      return chain(
        {
          data: {
            id: WEEK_ID,
            start_date: "2026-03-09",
            end_date: "2026-03-15",
          },
          error: null,
        },
        { maybeSingle: true }
      );
    });
    await expect(
      updatePlannerWeekDay({
        dayId: DAY_ID,
        date: "2026-04-01",
        mdTag: "MD",
        displayOrder: 0,
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "day_outside_week" },
    });

    await expect(
      deletePlannerWeekDay({
        weekDayId: DAY_ID,
        confirm: false as unknown as true,
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "confirmation_required" },
    });
    expect(fromMock).not.toHaveBeenCalledWith("planner_daily_targets");

    const del = chain(
      { data: { id: DAY_ID }, error: null },
      { maybeSingle: true }
    );
    fromMock.mockReturnValue(del);
    await expect(
      deletePlannerWeekDay({ weekDayId: DAY_ID, confirm: true })
    ).resolves.toEqual({
      ok: true,
      data: { weekDayId: DAY_ID },
    });
    expect(fromMock).toHaveBeenCalledWith("planner_week_days");
    expect(fromMock).not.toHaveBeenCalledWith("planner_daily_targets");
    expect(del.update).not.toHaveBeenCalled();
  });
});
