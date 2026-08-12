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
const getTrainingActualGpsBatchForDay = vi.fn();
vi.mock("@/lib/powerbi/queries/trainingActual.server", () => ({
  getTrainingActualGps: (...args: unknown[]) => getTrainingActualGps(...args),
  getTrainingActualGpsBatchForDay: (...args: unknown[]) =>
    getTrainingActualGpsBatchForDay(...args),
}));

import { getPlannerWeeklyReviewProgress } from "@/lib/gpsPlanner/progress.server";

const ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "a@t.com",
  role: "admin" as const,
};

const WEEK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const P_RAUL = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const P_NISTOR = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const P_MOSES = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const P_AMB = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const DAYS = [
  { id: "d1dddddd-dddd-4ddd-8ddd-dddddddddddd", week_id: WEEK_ID, date: "2026-08-05", md_tag: "MD-5" },
  { id: "d2dddddd-dddd-4ddd-8ddd-dddddddddddd", week_id: WEEK_ID, date: "2026-08-06", md_tag: "MD-4" },
  { id: "d3dddddd-dddd-4ddd-8ddd-dddddddddddd", week_id: WEEK_ID, date: "2026-08-07", md_tag: "MD-3" },
  { id: "d4dddddd-dddd-4ddd-8ddd-dddddddddddd", week_id: WEEK_ID, date: "2026-08-08", md_tag: "MD-2" },
  { id: "d5dddddd-dddd-4ddd-8ddd-dddddddddddd", week_id: WEEK_ID, date: "2026-08-09", md_tag: "MD-1" },
];

function metrics(td: number) {
  return {
    totalDistance: td,
    hsr: 1,
    sprint: 1,
    accelerations: 1,
    decelerations: 1,
  };
}

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

describe("getPlannerWeeklyReviewProgress day-batch reliability", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    getTrainingActualGps.mockReset();
    getTrainingActualGpsBatchForDay.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("issues one Power BI batch call per included day (not players × days)", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks")
        return chain(
          { data: { id: WEEK_ID, powerbi_week_id: "W4" }, error: null },
          { maybeSingle: true }
        );
      if (table === "planner_weekly_targets")
        return chain({
          data: [
            {
              week_id: WEEK_ID,
              player_id: P_RAUL,
              td_pct: 100,
              hsr_pct: 100,
              sprint_pct: 100,
              acc_pct: 100,
              dec_pct: 100,
            },
            {
              week_id: WEEK_ID,
              player_id: P_NISTOR,
              td_pct: 100,
              hsr_pct: 100,
              sprint_pct: 100,
              acc_pct: 100,
              dec_pct: 100,
            },
            {
              week_id: WEEK_ID,
              player_id: P_MOSES,
              td_pct: 100,
              hsr_pct: 100,
              sprint_pct: 100,
              acc_pct: 100,
              dec_pct: 100,
            },
            {
              week_id: WEEK_ID,
              player_id: P_AMB,
              td_pct: 100,
              hsr_pct: 100,
              sprint_pct: 100,
              acc_pct: 100,
              dec_pct: 100,
            },
          ],
          error: null,
        });
      if (table === "planner_match_best_snapshots")
        return chain({
          data: [
            {
              week_id: WEEK_ID,
              player_id: P_RAUL,
              td_best: 1000,
              hsr_best: 100,
              sprint_best: 50,
              acc_best: 10,
              dec_best: 10,
              powerbi_player_name: "Raul Cimpean",
              source_method: "single-match best",
            },
            {
              week_id: WEEK_ID,
              player_id: P_NISTOR,
              td_best: 1000,
              hsr_best: 100,
              sprint_best: 50,
              acc_best: 10,
              dec_best: 10,
              powerbi_player_name: "Akos Nistor",
              source_method: "single-match best",
            },
            {
              week_id: WEEK_ID,
              player_id: P_MOSES,
              td_best: 1000,
              hsr_best: 100,
              sprint_best: 50,
              acc_best: 10,
              dec_best: 10,
              powerbi_player_name: "Moses Mawa",
              source_method: "single-match best",
            },
            {
              week_id: WEEK_ID,
              player_id: P_AMB,
              td_best: 1000,
              hsr_best: 100,
              sprint_best: 50,
              acc_best: 10,
              dec_best: 10,
              powerbi_player_name: "Amb Player",
              source_method: "single-match best",
            },
          ],
          error: null,
        });
      if (table === "planner_week_days")
        return chain({ data: DAYS, error: null });
      if (table === "planner_daily_targets")
        return chain({ data: [], error: null });
      if (table === "profiles")
        return chain({
          data: [
            { id: P_RAUL, full_name: "Raul Cîmpean", email: null },
            { id: P_NISTOR, full_name: "Nistor Akos", email: null },
            { id: P_MOSES, full_name: "Moses Mawa", email: null },
            { id: P_AMB, full_name: "Amb Player", email: null },
          ],
          error: null,
        });
      return chain({ data: null, error: null }, { maybeSingle: true });
    });

    getTrainingActualGpsBatchForDay.mockImplementation(
      async (input: { mdTag: string; playerNames: string[] }) => {
        const byPlayerName = new Map();
        for (const name of input.playerNames) {
          if (name === "Akos Nistor" && (input.mdTag === "MD-5" || input.mdTag === "MD-4")) {
            byPlayerName.set(name, { status: "not_found" });
          } else if (name === "Amb Player" && input.mdTag === "MD-1") {
            byPlayerName.set(name, { status: "ambiguous" });
          } else {
            byPlayerName.set(name, { status: "found", metrics: metrics(100) });
          }
        }
        return { ok: true, byPlayerName };
      }
    );

    const result = await getPlannerWeeklyReviewProgress({
      weekId: WEEK_ID,
      throughDate: "2026-08-09",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 4 players × 5 days would be 20 single calls; batch = 5.
    expect(getTrainingActualGpsBatchForDay).toHaveBeenCalledTimes(5);
    expect(getTrainingActualGps).not.toHaveBeenCalled();

    const byId = new Map(result.data.map((p) => [p.playerId, p]));

    expect(byId.get(P_RAUL)?.actualCompleteness).toBe("complete");
    expect(byId.get(P_MOSES)?.actualCompleteness).toBe("complete");
    expect(byId.get(P_NISTOR)?.actualCompleteness).toBe("partial_not_found");
    expect(byId.get(P_NISTOR)?.foundDays).toBe(3);
    expect(byId.get(P_NISTOR)?.notFoundDays).toBe(2);
    expect(byId.get(P_NISTOR)?.weeklyToTarget).not.toBeNull();
    expect(byId.get(P_AMB)?.actualCompleteness).toBe("incomplete");
    expect(byId.get(P_AMB)?.weeklyToTarget).toBeNull();
  });

  it("marks all players actual_error for a day when the batch query fails", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks")
        return chain(
          { data: { id: WEEK_ID, powerbi_week_id: "W4" }, error: null },
          { maybeSingle: true }
        );
      if (table === "planner_weekly_targets")
        return chain({
          data: [
            {
              week_id: WEEK_ID,
              player_id: P_RAUL,
              td_pct: 100,
              hsr_pct: 100,
              sprint_pct: 100,
              acc_pct: 100,
              dec_pct: 100,
            },
          ],
          error: null,
        });
      if (table === "planner_match_best_snapshots")
        return chain({
          data: [
            {
              week_id: WEEK_ID,
              player_id: P_RAUL,
              td_best: 1000,
              hsr_best: 100,
              sprint_best: 50,
              acc_best: 10,
              dec_best: 10,
              powerbi_player_name: "Raul Cimpean",
              source_method: "single-match best",
            },
          ],
          error: null,
        });
      if (table === "planner_week_days")
        return chain({ data: DAYS.slice(0, 1), error: null });
      if (table === "planner_daily_targets")
        return chain({ data: [], error: null });
      if (table === "profiles")
        return chain({
          data: [{ id: P_RAUL, full_name: "Raul", email: null }],
          error: null,
        });
      return chain({ data: null, error: null }, { maybeSingle: true });
    });

    getTrainingActualGpsBatchForDay.mockResolvedValue({
      ok: false,
      error: { code: "timeout", message: "Power BI request timed out." },
    });

    const result = await getPlannerWeeklyReviewProgress({
      weekId: WEEK_ID,
      throughDate: "2026-08-09",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0].actualCompleteness).toBe("incomplete");
    expect(result.data[0].days[0].status).toBe("actual_error");
    expect(result.data[0].weeklyToTarget).toBeNull();
  });
});
