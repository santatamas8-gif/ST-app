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

const getTrainingActualGps = vi.fn();
vi.mock("@/lib/powerbi/queries/trainingActual.server", () => ({
  getTrainingActualGps: (...args: unknown[]) => getTrainingActualGps(...args),
}));

const getPlayerMapping = vi.fn();
vi.mock("@/lib/gpsPlanner/playerMappings.server", () => ({
  getPlayerMapping: (...args: unknown[]) => getPlayerMapping(...args),
}));

import {
  getPlannerDailyActual,
  getPlannerDailyAnalysis,
  getPlannerWeeklyProgress,
} from "@/lib/gpsPlanner/progress.server";

const ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "a@t.com",
  role: "admin" as const,
};

const WEEK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DAY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const DAY_ID_2 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const DAY_ID_3 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const PLAYER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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

describe("planner actual identity", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    getTrainingActualGps.mockReset();
    getPlayerMapping.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("uses frozen Old Exact Name and powerbi_week_id + date; not current mapping", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_week_days")
        return chain(
          {
            data: {
              id: DAY_ID,
              week_id: WEEK_ID,
              date: "2026-03-10",
              md_tag: "MD-1",
            },
            error: null,
          },
          { maybeSingle: true }
        );
      if (table === "planner_weeks")
        return chain(
          { data: { id: WEEK_ID, powerbi_week_id: "W6" }, error: null },
          { maybeSingle: true }
        );
      if (table === "planner_match_best_snapshots")
        return chain(
          {
            data: {
              week_id: WEEK_ID,
              player_id: PLAYER_ID,
              td_best: 800,
              hsr_best: 800,
              sprint_best: 100,
              acc_best: 40,
              dec_best: 35,
              powerbi_player_name: "Old  Exact Name",
              source_method: "single-match best",
            },
            error: null,
          },
          { maybeSingle: true }
        );
      throw new Error(table);
    });

    getTrainingActualGps.mockResolvedValue({
      ok: true,
      data: {
        totalDistance: 700,
        hsr: 355,
        sprint: 90,
        accelerations: 30,
        decelerations: 28,
      },
    });

    const result = await getPlannerDailyActual({
      weekDayId: DAY_ID,
      playerId: PLAYER_ID,
    });
    expect(result.ok).toBe(true);
    expect(getPlayerMapping).not.toHaveBeenCalled();
    expect(getTrainingActualGps).toHaveBeenCalledTimes(1);
    expect(getTrainingActualGps).toHaveBeenCalledWith({
      playerName: "Old  Exact Name",
      weekId: "W6",
      mdTag: "MD-1",
      date: "2026-03-10",
    });
    expect(getTrainingActualGps.mock.calls[0][0].weekId).not.toBe(WEEK_ID);
  });
});

describe("daily analysis", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    getTrainingActualGps.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  function setupAnalysis(opts: {
    hasDaily: boolean;
    actual:
      | { ok: true; data: Record<string, number | null> }
      | { ok: false; error: { code: string; message: string } };
  }) {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_week_days")
        return chain(
          {
            data: {
              id: DAY_ID,
              week_id: WEEK_ID,
              date: "2026-03-10",
              md_tag: "MD-1",
            },
            error: null,
          },
          { maybeSingle: true }
        );
      if (table === "planner_weeks")
        return chain(
          { data: { id: WEEK_ID, powerbi_week_id: "W6" }, error: null },
          { maybeSingle: true }
        );
      if (table === "planner_match_best_snapshots")
        return chain(
          {
            data: {
              week_id: WEEK_ID,
              player_id: PLAYER_ID,
              td_best: 800,
              hsr_best: 800,
              sprint_best: 100,
              acc_best: 40,
              dec_best: 35,
              powerbi_player_name: "Frozen",
              source_method: "single-match best",
            },
            error: null,
          },
          { maybeSingle: true }
        );
      if (table === "planner_daily_targets")
        return chain(
          {
            data: opts.hasDaily
              ? {
                  week_day_id: DAY_ID,
                  player_id: PLAYER_ID,
                  td_pct: 50,
                  hsr_pct: 50,
                  sprint_pct: 120,
                  acc_pct: 25,
                  dec_pct: 25,
                }
              : null,
            error: null,
          },
          { maybeSingle: true }
        );
      if (table === "profiles")
        return chain(
          { data: { full_name: "Player One", email: null }, error: null },
          { maybeSingle: true }
        );
      throw new Error(table);
    });
    getTrainingActualGps.mockResolvedValue(opts.actual);
  }

  it("computes planned/actual/difference with correct signs", async () => {
    setupAnalysis({
      hasDaily: true,
      actual: {
        ok: true,
        data: {
          totalDistance: 400,
          hsr: 355,
          sprint: 138,
          accelerations: 10,
          decelerations: 8,
        },
      },
    });
    const result = await getPlannerDailyAnalysis({
      weekDayId: DAY_ID,
      playerId: PLAYER_ID,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.planned?.hsr).toBe(400);
    expect(result.data.planned?.sprint).toBe(120);
    expect(result.data.difference?.hsr).toBe(45);
    expect(result.data.difference?.sprint).toBe(-18);
  });

  it("keeps difference null when Actual not_found; Actual without target has no planned", async () => {
    setupAnalysis({
      hasDaily: true,
      actual: { ok: false, error: { code: "not_found", message: "x" } },
    });
    const missing = await getPlannerDailyAnalysis({
      weekDayId: DAY_ID,
      playerId: PLAYER_ID,
    });
    expect(missing.ok).toBe(true);
    if (!missing.ok) return;
    expect(missing.data.planned?.hsr).toBe(400);
    expect(missing.data.actualStatus).toBe("actual_not_found");
    expect(missing.data.difference).toBeNull();

    setupAnalysis({
      hasDaily: false,
      actual: {
        ok: true,
        data: {
          totalDistance: 700,
          hsr: 300,
          sprint: 80,
          accelerations: 20,
          decelerations: 18,
        },
      },
    });
    const noTarget = await getPlannerDailyAnalysis({
      weekDayId: DAY_ID,
      playerId: PLAYER_ID,
    });
    expect(noTarget.ok).toBe(true);
    if (!noTarget.ok) return;
    expect(noTarget.data.hasDailyTarget).toBe(false);
    expect(noTarget.data.planned).toBeNull();
    expect(noTarget.data.difference).toBeNull();
    expect(noTarget.data.actual?.hsr).toBe(300);
  });

  it("does not invent Difference for ambiguous Actual", async () => {
    setupAnalysis({
      hasDaily: true,
      actual: { ok: false, error: { code: "ambiguous", message: "dup" } },
    });
    const result = await getPlannerDailyAnalysis({
      weekDayId: DAY_ID,
      playerId: PLAYER_ID,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.actualStatus).toBe("actual_ambiguous");
    expect(result.data.difference).toBeNull();
  });
});

describe("weekly progress", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    getTrainingActualGps.mockReset();
    getPlayerMapping.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("filters by throughDate, queries Actual without Daily Target, preserves not_found vs zero", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks")
        return chain(
          { data: { id: WEEK_ID, powerbi_week_id: "W6" }, error: null },
          { maybeSingle: true }
        );
      if (table === "planner_match_best_snapshots")
        return chain(
          {
            data: {
              week_id: WEEK_ID,
              player_id: PLAYER_ID,
              td_best: 800,
              hsr_best: 800,
              sprint_best: 100,
              acc_best: 40,
              dec_best: 35,
              powerbi_player_name: "Frozen Name",
              source_method: "single-match best",
            },
            error: null,
          },
          { maybeSingle: true }
        );
      if (table === "planner_weekly_targets")
        return chain(
          {
            data: {
              week_id: WEEK_ID,
              player_id: PLAYER_ID,
              td_pct: 140,
              hsr_pct: 140,
              sprint_pct: 100,
              acc_pct: 100,
              dec_pct: 100,
            },
            error: null,
          },
          { maybeSingle: true }
        );
      if (table === "planner_week_days")
        return chain({
          data: [
            {
              id: DAY_ID,
              week_id: WEEK_ID,
              date: "2026-03-10",
              md_tag: "MD-4",
            },
            {
              id: DAY_ID_2,
              week_id: WEEK_ID,
              date: "2026-03-12",
              md_tag: "MD-2",
            },
            {
              id: DAY_ID_3,
              week_id: WEEK_ID,
              date: "2026-03-14",
              md_tag: "MD0",
            },
          ],
          error: null,
        });
      if (table === "planner_daily_targets")
        return chain({
          data: [
            {
              week_day_id: DAY_ID,
              player_id: PLAYER_ID,
              td_pct: 40,
              hsr_pct: 40,
              sprint_pct: 40,
              acc_pct: 40,
              dec_pct: 40,
            },
            {
              week_day_id: DAY_ID_2,
              player_id: PLAYER_ID,
              td_pct: 90,
              hsr_pct: 90,
              sprint_pct: 90,
              acc_pct: 90,
              dec_pct: 90,
            },
          ],
          error: null,
        });
      if (table === "profiles")
        return chain(
          { data: { full_name: "Player One", email: null }, error: null },
          { maybeSingle: true }
        );
      throw new Error(table);
    });

    getTrainingActualGps
      .mockResolvedValueOnce({
        ok: true,
        data: {
          totalDistance: 500,
          hsr: 200,
          sprint: 40,
          accelerations: 10,
          decelerations: 8,
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "not_found", message: "missing" },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          totalDistance: 0,
          hsr: 0,
          sprint: 0,
          accelerations: 0,
          decelerations: 0,
        },
      });

    const throughMid = await getPlannerWeeklyProgress({
      weekId: WEEK_ID,
      playerId: PLAYER_ID,
      throughDate: "2026-03-12",
    });
    expect(throughMid.ok).toBe(true);
    if (!throughMid.ok) return;
    expect(throughMid.data.includedDays).toBe(2);
    expect(getTrainingActualGps).toHaveBeenCalledTimes(2);
    expect(throughMid.data.days.some((d) => d.date === "2026-03-14")).toBe(
      false
    );
    expect(throughMid.data.weeklyPlanned.hsr).toBe(1120);
    expect(throughMid.data.dailyAllocationSum.hsrPct).toBe(130);
    expect(throughMid.data.remainingToAllocate.hsrPct).toBe(10);
    expect(throughMid.data.foundDays).toBe(1);
    expect(throughMid.data.notFoundDays).toBe(1);
    expect(throughMid.data.weeklyActual?.hsr).toBe(200);
    expect(throughMid.data.weeklyToTarget?.hsr).toBe(920);
    expect(getPlayerMapping).not.toHaveBeenCalled();

    // Day without Daily Target still queried when included
    expect(throughMid.data.days[1].hasDailyTarget).toBe(true);

    getTrainingActualGps.mockReset();
    getTrainingActualGps
      .mockResolvedValueOnce({
        ok: true,
        data: {
          totalDistance: 500,
          hsr: 200,
          sprint: 40,
          accelerations: 10,
          decelerations: 8,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          totalDistance: 0,
          hsr: 0,
          sprint: 0,
          accelerations: 0,
          decelerations: 0,
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "ambiguous", message: "dup" },
      });

    // Include a day with no daily target by clearing daily for day3 — already only 2 dailies
    const full = await getPlannerWeeklyProgress({
      weekId: WEEK_ID,
      playerId: PLAYER_ID,
      throughDate: "2026-03-14",
    });
    expect(full.ok).toBe(true);
    if (!full.ok) return;
    expect(full.data.includedDays).toBe(3);
    expect(full.data.days[2].hasDailyTarget).toBe(false);
    expect(getTrainingActualGps).toHaveBeenCalledTimes(3);
    expect(full.data.days[2].status).toBe("actual_ambiguous");
    expect(full.data.actualCompleteness).toBe("incomplete");
    expect(full.data.weeklyToTarget).toBeNull();
    // zero actual remains zero when found
    expect(full.data.days[1].actual?.hsr).toBe(0);
  });

  it("does not treat empty includedDays as complete zero Actual", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks")
        return chain(
          { data: { id: WEEK_ID, powerbi_week_id: "W6" }, error: null },
          { maybeSingle: true }
        );
      if (table === "planner_match_best_snapshots")
        return chain(
          {
            data: {
              week_id: WEEK_ID,
              player_id: PLAYER_ID,
              td_best: 800,
              hsr_best: 800,
              sprint_best: 100,
              acc_best: 40,
              dec_best: 35,
              powerbi_player_name: "Frozen Name",
              source_method: "single-match best",
            },
            error: null,
          },
          { maybeSingle: true }
        );
      if (table === "planner_weekly_targets")
        return chain(
          {
            data: {
              week_id: WEEK_ID,
              player_id: PLAYER_ID,
              td_pct: 140,
              hsr_pct: 140,
              sprint_pct: 100,
              acc_pct: 100,
              dec_pct: 100,
            },
            error: null,
          },
          { maybeSingle: true }
        );
      if (table === "planner_week_days")
        return chain({
          data: [
            {
              id: DAY_ID,
              week_id: WEEK_ID,
              date: "2026-03-10",
              md_tag: "MD-4",
            },
          ],
          error: null,
        });
      if (table === "planner_daily_targets")
        return chain({ data: [], error: null });
      return chain({ data: null, error: null }, { maybeSingle: true });
    });

    const result = await getPlannerWeeklyProgress({
      weekId: WEEK_ID,
      playerId: PLAYER_ID,
      throughDate: "2026-03-01",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.includedDays).toBe(0);
    expect(result.data.actualCompleteness).toBe("partial_not_found");
    expect(result.data.weeklyActual).toBeNull();
    expect(result.data.weeklyToTarget).toBeNull();
    expect(getTrainingActualGps).not.toHaveBeenCalled();
  });
});
