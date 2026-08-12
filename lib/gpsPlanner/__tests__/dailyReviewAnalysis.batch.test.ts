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

import {
  getPlannerDailyAnalysis,
  getPlannerDailyReviewAnalysis,
} from "@/lib/gpsPlanner/progress.server";

const ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "a@t.com",
  role: "admin" as const,
};

const WEEK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DAY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function uuid(n: number): string {
  const hex = n.toString(16).padStart(12, "0");
  return `bbbbbbbb-bbbb-4bbb-8bbb-${hex}`;
}

function metrics(
  partial?: Partial<{
    totalDistance: number;
    hsr: number;
    sprint: number;
    accelerations: number;
    decelerations: number;
  }>
) {
  return {
    totalDistance: 6604.59,
    hsr: 254.41,
    sprint: 84.2,
    accelerations: 28,
    decelerations: 44,
    ...partial,
  };
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

type Snap = {
  week_id: string;
  player_id: string;
  td_best: number;
  hsr_best: number;
  sprint_best: number;
  acc_best: number;
  dec_best: number;
  powerbi_player_name: string;
  source_method: string;
};

function setupReviewFixture(input: {
  names: string[];
  missingDailyNames?: string[];
  tdBest?: number;
}) {
  const targets = input.names.map((_, i) => ({
    week_id: WEEK_ID,
    player_id: uuid(i + 1),
    td_pct: 100,
    hsr_pct: 100,
    sprint_pct: 100,
    acc_pct: 100,
    dec_pct: 100,
  }));
  const snapshots: Snap[] = input.names.map((name, i) => ({
    week_id: WEEK_ID,
    player_id: uuid(i + 1),
    td_best: input.tdBest ?? 1000,
    hsr_best: 100,
    sprint_best: 50,
    acc_best: 10,
    dec_best: 10,
    powerbi_player_name: name,
    source_method: "single-match best",
  }));
  const missingNames = new Set(input.missingDailyNames ?? []);
  const dailies = input.names
    .map((name, i) => ({ name, player_id: uuid(i + 1) }))
    .filter((x) => !missingNames.has(x.name))
    .map((x) => ({
      week_day_id: DAY_ID,
      player_id: x.player_id,
      td_pct: 50,
      hsr_pct: 40,
      sprint_pct: 30,
      acc_pct: 20,
      dec_pct: 10,
    }));

  fromMock.mockImplementation((table: string) => {
    if (table === "planner_week_days") {
      return chain(
        {
          data: {
            id: DAY_ID,
            week_id: WEEK_ID,
            date: "2026-08-07",
            md_tag: "MD-3",
          },
          error: null,
        },
        { maybeSingle: true }
      );
    }
    if (table === "planner_weeks") {
      return chain(
        { data: { id: WEEK_ID, powerbi_week_id: "W4" }, error: null },
        { maybeSingle: true }
      );
    }
    if (table === "planner_weekly_targets") {
      return chain({ data: targets, error: null });
    }
    if (table === "planner_match_best_snapshots") {
      // Support both Review `.eq().in()` list and single `.eq().eq().maybeSingle()`.
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({ data: snapshots, error: null }),
            eq: vi.fn((_c2: string, playerId: string) => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data:
                  snapshots.find((s) => s.player_id === playerId) ?? null,
                error: null,
              }),
            })),
          })),
        })),
      };
    }
    if (table === "planner_daily_targets") {
      // Review uses `.eq(week_day_id).in(player_id)` thenable;
      // single analysis uses `.eq().eq().maybeSingle()`.
      return {
        select: vi.fn(() => ({
          eq: vi.fn((_col: string, val: string) => {
            if (_col === "week_day_id" || val === DAY_ID) {
              return {
                in: vi.fn().mockResolvedValue({ data: dailies, error: null }),
                eq: vi.fn((_c2: string, playerId: string) => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data:
                      dailies.find((d) => d.player_id === playerId) ?? null,
                    error: null,
                  }),
                })),
              };
            }
            return {
              in: vi.fn().mockResolvedValue({ data: dailies, error: null }),
              eq: vi.fn((_c2: string, playerId: string) => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data:
                    dailies.find((d) => d.player_id === playerId) ?? null,
                  error: null,
                }),
              })),
            };
          }),
        })),
      };
    }
    if (table === "profiles") {
      return {
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({
            data: targets.map((t, i) => ({
              id: t.player_id,
              full_name: `Display ${i + 1}`,
              email: null,
            })),
            error: null,
          }),
          eq: vi.fn((_c: string, playerId: string) => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                full_name:
                  targets.find((t) => t.player_id === playerId)?.player_id ??
                  null,
                email: null,
              },
              error: null,
            }),
          })),
        })),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });

  return { targets, snapshots, dailies };
}

describe("getPlannerDailyReviewAnalysis day-batch reliability", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    getTrainingActualGps.mockReset();
    getTrainingActualGpsBatchForDay.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("issues ONE Power BI batch call for 20 Daily Review players (not 20 singles)", async () => {
    const names = Array.from({ length: 20 }, (_, i) => `Player ${i + 1}`);
    const { snapshots } = setupReviewFixture({ names });
    getTrainingActualGpsBatchForDay.mockResolvedValue({
      ok: true,
      byPlayerName: new Map(
        snapshots.map((s) => [
          s.powerbi_player_name,
          { status: "found" as const, metrics: metrics() },
        ])
      ),
    });

    const result = await getPlannerDailyReviewAnalysis({ weekDayId: DAY_ID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(20);
    expect(getTrainingActualGpsBatchForDay).toHaveBeenCalledTimes(1);
    expect(getTrainingActualGps).not.toHaveBeenCalled();
    expect(getTrainingActualGpsBatchForDay).toHaveBeenCalledWith({
      weekId: "W4",
      mdTag: "MD-3",
      date: "2026-08-07",
      playerNames: names,
    });
  });

  it("classifies mixed batch rows independently (found / not_found / ambiguous)", async () => {
    setupReviewFixture({
      names: ["Player A", "Player B", "Player C"],
    });
    getTrainingActualGpsBatchForDay.mockResolvedValue({
      ok: true,
      byPlayerName: new Map([
        [
          "Player A",
          { status: "found", metrics: metrics({ totalDistance: 100 }) },
        ],
        ["Player B", { status: "not_found" }],
        ["Player C", { status: "ambiguous" }],
      ]),
    });

    const result = await getPlannerDailyReviewAnalysis({ weekDayId: DAY_ID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const byName = new Map(
      result.data.map((r) => [r.powerBiPlayerName, r])
    );
    const a = byName.get("Player A")!;
    const b = byName.get("Player B")!;
    const c = byName.get("Player C")!;

    expect(a.actualStatus).toBe("actual_found");
    expect(a.actual?.totalDistance).toBe(100);
    expect(a.planned).not.toBeNull();
    expect(a.difference).not.toBeNull();

    expect(b.actualStatus).toBe("actual_not_found");
    expect(b.actual).toBeNull();
    expect(b.difference).toBeNull();

    expect(c.actualStatus).toBe("actual_ambiguous");
    expect(c.actual).toBeNull();
    expect(c.difference).toBeNull();
  });

  it("keeps Actual when Daily Target missing; Planned/Difference stay null", async () => {
    const raw = metrics();
    setupReviewFixture({
      names: ["Alin Dobrosavlevici"],
      missingDailyNames: ["Alin Dobrosavlevici"],
      tdBest: 10000,
    });
    getTrainingActualGpsBatchForDay.mockResolvedValue({
      ok: true,
      byPlayerName: new Map([
        ["Alin Dobrosavlevici", { status: "found", metrics: raw }],
      ]),
    });

    const result = await getPlannerDailyReviewAnalysis({ weekDayId: DAY_ID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    const row = result.data[0];
    expect(row.hasDailyTarget).toBe(false);
    expect(row.planned).toBeNull();
    expect(row.difference).toBeNull();
    expect(row.actualStatus).toBe("actual_found");
    expect(row.actual).toEqual(raw);
  });

  it("returns identical Actual/Planned/Difference to single-player analysis", async () => {
    const raw = metrics();
    const { targets } = setupReviewFixture({
      names: ["Alin Dobrosavlevici"],
      tdBest: 12000,
    });
    getTrainingActualGpsBatchForDay.mockResolvedValue({
      ok: true,
      byPlayerName: new Map([
        ["Alin Dobrosavlevici", { status: "found", metrics: raw }],
      ]),
    });
    getTrainingActualGps.mockResolvedValue({ ok: true, data: raw });

    const batch = await getPlannerDailyReviewAnalysis({ weekDayId: DAY_ID });
    expect(batch.ok).toBe(true);
    if (!batch.ok) return;

    const single = await getPlannerDailyAnalysis({
      weekDayId: DAY_ID,
      playerId: targets[0].player_id,
    });
    expect(single.ok).toBe(true);
    if (!single.ok) return;

    expect(batch.data[0].actual).toEqual(single.data.actual);
    expect(batch.data[0].planned).toEqual(single.data.planned);
    expect(batch.data[0].difference).toEqual(single.data.difference);
    expect(batch.data[0].actualStatus).toBe(single.data.actualStatus);
    expect(getTrainingActualGpsBatchForDay).toHaveBeenCalledTimes(1);
    expect(getTrainingActualGps).toHaveBeenCalledTimes(1);
  });

  it("marks all players actual_error when the whole batch fails", async () => {
    setupReviewFixture({ names: ["A", "B", "C"] });
    getTrainingActualGpsBatchForDay.mockResolvedValue({
      ok: false,
      error: { code: "upstream_error", message: "timeout" },
    });

    const result = await getPlannerDailyReviewAnalysis({ weekDayId: DAY_ID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(3);
    for (const row of result.data) {
      expect(row.actualStatus).toBe("actual_error");
      expect(row.actual).toBeNull();
      expect(row.difference).toBeNull();
      expect(row.planned).not.toBeNull();
    }
    expect(getTrainingActualGps).not.toHaveBeenCalled();
  });

  it("classifies actual_incomplete independently; other players stay valid", async () => {
    const { dailyComplianceTone } = await import(
      "@/lib/gpsPlanner/reviewCompliance"
    );
    const validA = metrics({ totalDistance: 100 });
    // Existing Training Actual contract: found row with a null metric → incomplete.
    // Must NOT coerce missing metric to 0.
    const incompleteB = {
      totalDistance: 500,
      hsr: null as number | null,
      sprint: 10,
      accelerations: 5,
      decelerations: 5,
    };
    setupReviewFixture({
      names: ["Player A", "Player B", "Player C"],
      tdBest: 1000,
    });
    getTrainingActualGpsBatchForDay.mockResolvedValue({
      ok: true,
      byPlayerName: new Map([
        ["Player A", { status: "found" as const, metrics: validA }],
        ["Player B", { status: "found" as const, metrics: incompleteB }],
        ["Player C", { status: "not_found" as const }],
      ]),
    });

    const result = await getPlannerDailyReviewAnalysis({ weekDayId: DAY_ID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const byName = new Map(result.data.map((r) => [r.powerBiPlayerName, r]));
    const a = byName.get("Player A")!;
    const b = byName.get("Player B")!;
    const c = byName.get("Player C")!;

    // Player A — complete independence: remains valid.
    expect(a.actualStatus).toBe("actual_found");
    expect(a.actual).toEqual(validA);
    expect(a.actual?.hsr).toBe(254.41);
    expect(a.difference).not.toBeNull();
    expect(
      dailyComplianceTone({
        metric: "td",
        difference: a.difference!.totalDistance,
      })
    ).not.toBeNull();

    // Player B — actual_incomplete: unsafe Actual withheld.
    expect(b.actualStatus).not.toBe("actual_found");
    expect(b.actualStatus).toBe("actual_incomplete");
    expect(b.actual).toBeNull();
    expect(b.difference).toBeNull();
    // No compliance color when Difference is withheld.
    expect(
      dailyComplianceTone({
        metric: "td",
        difference: b.difference?.totalDistance ?? null,
      })
    ).toBeNull();
    expect(
      dailyComplianceTone({
        metric: "hsr",
        difference: b.difference?.hsr ?? null,
      })
    ).toBeNull();
    // Incomplete metric must never become zero Actual.
    expect(b.actual?.hsr).toBeUndefined();
    expect(Object.values(b.actual ?? {})).not.toContain(0);

    // Player C — not_found stays independent.
    expect(c.actualStatus).toBe("actual_not_found");
    expect(c.actual).toBeNull();
    expect(c.difference).toBeNull();
  });

  it("matches single-player contract exactly for actual_incomplete", async () => {
    const { dailyComplianceTone } = await import(
      "@/lib/gpsPlanner/reviewCompliance"
    );
    const incomplete = {
      totalDistance: 6604.59,
      hsr: 254.41,
      sprint: null as number | null,
      accelerations: 28,
      decelerations: 44,
    };
    const { targets } = setupReviewFixture({
      names: ["Incomplete Player"],
      tdBest: 12000,
    });
    getTrainingActualGpsBatchForDay.mockResolvedValue({
      ok: true,
      byPlayerName: new Map([
        ["Incomplete Player", { status: "found" as const, metrics: incomplete }],
      ]),
    });
    getTrainingActualGps.mockResolvedValue({ ok: true, data: incomplete });

    const batch = await getPlannerDailyReviewAnalysis({ weekDayId: DAY_ID });
    expect(batch.ok).toBe(true);
    if (!batch.ok) return;

    const single = await getPlannerDailyAnalysis({
      weekDayId: DAY_ID,
      playerId: targets[0].player_id,
    });
    expect(single.ok).toBe(true);
    if (!single.ok) return;

    const b = batch.data[0];
    const s = single.data;

    expect(b.actualStatus).toBe("actual_incomplete");
    expect(s.actualStatus).toBe("actual_incomplete");
    expect(b.actualStatus).toBe(s.actualStatus);
    expect(b.actual).toBeNull();
    expect(s.actual).toBeNull();
    expect(b.actual).toEqual(s.actual);
    expect(b.difference).toBeNull();
    expect(s.difference).toBeNull();
    expect(b.difference).toEqual(s.difference);
    expect(b.planned).toEqual(s.planned);

    // Quality / compliance behavior parity (Difference withheld → neutral).
    expect(
      dailyComplianceTone({
        metric: "sprint",
        difference: b.difference?.sprint ?? null,
      })
    ).toBeNull();
    expect(
      dailyComplianceTone({
        metric: "sprint",
        difference: s.difference?.sprint ?? null,
      })
    ).toBeNull();
  });

  it("exact raw Actual equality single vs batch for all five metrics (no rounding)", async () => {
    const raw = {
      totalDistance: 6604.59,
      hsr: 254.41,
      sprint: 84.2,
      accelerations: 28,
      decelerations: 44,
    };
    const { targets } = setupReviewFixture({
      names: ["Alin Dobrosavlevici"],
      tdBest: 12000,
    });
    getTrainingActualGpsBatchForDay.mockResolvedValue({
      ok: true,
      byPlayerName: new Map([
        ["Alin Dobrosavlevici", { status: "found" as const, metrics: raw }],
      ]),
    });
    getTrainingActualGps.mockResolvedValue({ ok: true, data: raw });

    const batch = await getPlannerDailyReviewAnalysis({ weekDayId: DAY_ID });
    expect(batch.ok).toBe(true);
    if (!batch.ok) return;
    const single = await getPlannerDailyAnalysis({
      weekDayId: DAY_ID,
      playerId: targets[0].player_id,
    });
    expect(single.ok).toBe(true);
    if (!single.ok) return;

    const ba = batch.data[0].actual!;
    const sa = single.data.actual!;
    expect(ba.totalDistance).toBe(sa.totalDistance);
    expect(ba.hsr).toBe(sa.hsr);
    expect(ba.sprint).toBe(sa.sprint);
    expect(ba.accelerations).toBe(sa.accelerations);
    expect(ba.decelerations).toBe(sa.decelerations);
    expect(ba.totalDistance).toBe(6604.59);
    expect(ba.hsr).toBe(254.41);
    expect(ba.sprint).toBe(84.2);
    expect(ba.accelerations).toBe(28);
    expect(ba.decelerations).toBe(44);
    // Object equality without any intermediate rounding.
    expect(ba).toEqual(sa);
    expect(ba).toEqual(raw);
  });
});
