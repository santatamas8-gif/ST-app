import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getAppUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getAppUser: (...args: unknown[]) => getAppUser(...args),
  isAdmin: (role: string) => role === "admin",
}));

const getPlannerDailyTarget = vi.fn();
vi.mock("@/lib/gpsPlanner/dailyTargets.server", () => ({
  getPlannerDailyTarget: (...args: unknown[]) => getPlannerDailyTarget(...args),
}));

const getPlannerWeeklyTarget = vi.fn();
vi.mock("@/lib/gpsPlanner/weeklyTargets.server", () => ({
  getPlannerWeeklyTarget: (...args: unknown[]) =>
    getPlannerWeeklyTarget(...args),
}));

const getPlannerWeek = vi.fn();
vi.mock("@/lib/gpsPlanner/weeks.server", () => ({
  getPlannerWeek: (...args: unknown[]) => getPlannerWeek(...args),
}));

const getTrainingActualGps = vi.fn();
vi.mock("@/lib/powerbi/queries/trainingActual", () => ({
  getTrainingActualGps: (...args: unknown[]) => getTrainingActualGps(...args),
}));
vi.mock("@/lib/powerbi/queries/trainingActual.server", () => ({
  getTrainingActualGps: (...args: unknown[]) => getTrainingActualGps(...args),
}));

const getPlannerWeeklyProgress = vi.fn();
const getPlannerDailyAnalysis = vi.fn();
vi.mock("@/lib/gpsPlanner/progress.server", () => ({
  getPlannerWeeklyProgress: (...args: unknown[]) =>
    getPlannerWeeklyProgress(...args),
  getPlannerWeeklyReviewProgress: vi.fn(),
  getPlannerDailyAnalysis: (...args: unknown[]) =>
    getPlannerDailyAnalysis(...args),
  getPlannerDailyReviewAnalysis: vi.fn(),
}));

type FromHandler = (table: string) => {
  select: (cols: string) => {
    eq: (col: string, val: string) => {
      maybeSingle: () => Promise<{ data: unknown; error: null }>;
    };
    in: (col: string, vals: string[]) => Promise<{ data: unknown; error: null }>;
  };
};

let fromHandler: FromHandler;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => fromHandler(table),
  }),
}));

import { getDailyPlanForPrint } from "@/lib/gpsPlanner/dailyPlan.server";
import {
  averageValidAbsolutes,
  buildPctSummary,
  buildTeamAverage,
  summarizeSharedPercentage,
} from "@/lib/gpsPlanner/dailyPlanSummary";

const ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "a@t.com",
  role: "admin" as const,
};

const DAY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const WEEK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const P1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const P2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const P3 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function weeklyView(
  playerId: string,
  pct: {
    tdPct: number;
    hsrPct: number;
    sprintPct: number;
    accPct: number;
    decPct: number;
  }
) {
  return {
    weekId: WEEK_ID,
    playerId,
    playerDisplayName: playerId,
    ...pct,
    tdBest: 10000,
    hsrBest: 800,
    sprintBest: 200,
    accBest: 40,
    decBest: 40,
    powerBiPlayerName: "X",
    sourceMethod: "single-match best",
    totalDistance: 10000,
    hsr: 800,
    sprint: 200,
    accelerations: 40,
    decelerations: 40,
    createdAt: "",
    updatedAt: "",
    createdBy: null,
    updatedBy: null,
  };
}

function stubDayAndProfiles(opts?: {
  day?: { id: string; week_id: string; date: string; md_tag: string } | null;
  profiles?: { id: string; full_name: string | null; email: string | null }[];
}) {
  const day =
    opts && "day" in opts && opts.day === null
      ? null
      : (opts?.day ?? {
          id: DAY_ID,
          week_id: WEEK_ID,
          date: "2026-03-10",
          md_tag: "MD-3",
        });
  const profiles = opts?.profiles ?? [
    { id: P2, full_name: "Player Two", email: "p2@t.com" },
    { id: P3, full_name: "Player Three", email: null },
  ];

  fromHandler = (table: string) => {
    if (table === "planner_week_days") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: day, error: null }),
          }),
          in: async () => ({ data: [], error: null }),
        }),
      };
    }
    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
          in: async () => ({ data: profiles, error: null }),
        }),
      };
    }
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
        in: async () => ({ data: [], error: null }),
      }),
    };
  };
}

describe("dailyPlanSummary pure helpers", () => {
  it("shared %: same → value, different → Mixed, empty → null", () => {
    expect(summarizeSharedPercentage([50, 50, 50])).toBe(50);
    expect(summarizeSharedPercentage([50, 40])).toBe("Mixed");
    expect(summarizeSharedPercentage([])).toBeNull();
  });

  it("metric independence: TD same while HSR Mixed", () => {
    const summary = buildPctSummary({
      td: [55, 55],
      hsr: [50, 40],
      sprint: [40],
      acc: [],
      dec: [45, 45],
    });
    expect(summary.td).toBe(55);
    expect(summary.hsr).toBe("Mixed");
    expect(summary.sprint).toBe(40);
    expect(summary.acc).toBeNull();
    expect(summary.dec).toBe(45);
  });

  it("team average uses raw values and excludes missing (not zero)", () => {
    expect(averageValidAbsolutes([5000, 7000])).toBe(6000);
    expect(averageValidAbsolutes([100, 200])).toBe(150);
    expect(averageValidAbsolutes([])).toBeNull();

    const avg = buildTeamAverage({
      totalDistance: [5000.4, 7000.6],
      hsr: [100.2, 200.4],
      sprint: [],
      accelerations: [10],
      decelerations: [20, 30],
    });
    expect(avg.totalDistance).toBeCloseTo(6000.5, 5);
    expect(avg.hsr).toBeCloseTo(150.3, 5);
    expect(avg.sprint).toBeNull();
    expect(avg.accelerations).toBe(10);
    expect(avg.decelerations).toBe(25);
  });
});

describe("getDailyPlanForPrint", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    getPlannerDailyTarget.mockReset();
    getPlannerWeeklyTarget.mockReset();
    getPlannerWeek.mockReset();
    getTrainingActualGps.mockReset();
    getPlannerWeeklyProgress.mockReset();
    getPlannerDailyAnalysis.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
    stubDayAndProfiles();
    getPlannerWeek.mockResolvedValue({
      ok: true,
      data: {
        id: WEEK_ID,
        powerbiWeekId: "4",
        startDate: "2026-03-09",
        endDate: "2026-03-15",
        weekType: "maintaining",
        overloadFocus: [],
        status: "active",
        createdBy: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    });
    getPlannerWeeklyTarget.mockResolvedValue({ ok: true, data: null });
  });

  it("rejects non-admin", async () => {
    getAppUser.mockResolvedValue({ ...ADMIN, role: "staff" });
    const result = await getDailyPlanForPrint({
      weekDayId: DAY_ID,
      playerIds: [P1],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unauthorized");
  });

  it("rejects empty playerIds", async () => {
    const result = await getDailyPlanForPrint({
      weekDayId: DAY_ID,
      playerIds: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_input");
  });

  it("returns day_not_found when week day missing", async () => {
    stubDayAndProfiles({ day: null });
    const result = await getDailyPlanForPrint({
      weekDayId: DAY_ID,
      playerIds: [P1],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("day_not_found");
  });

  it("preserves selected player order and maps absolutes", async () => {
    getPlannerDailyTarget.mockImplementation(
      async (_dayId: string, playerId: string) => {
        if (playerId === P1) {
          return {
            ok: true,
            data: {
              weekId: WEEK_ID,
              weekDayId: DAY_ID,
              date: "2026-03-10",
              mdTag: "MD-3",
              playerId: P1,
              playerDisplayName: "Player One",
              tdPct: 40,
              hsrPct: 50,
              sprintPct: 30,
              accPct: 45,
              decPct: 45,
              tdBest: 10000,
              hsrBest: 800,
              sprintBest: 200,
              accBest: 40,
              decBest: 40,
              powerBiPlayerName: "P1",
              totalDistance: 4000.4,
              hsr: 400.5,
              sprint: 60.2,
              accelerations: 18.6,
              decelerations: 17.4,
              createdAt: "",
              updatedAt: "",
              createdBy: null,
              updatedBy: null,
            },
          };
        }
        if (playerId === P3) {
          return {
            ok: true,
            data: {
              weekId: WEEK_ID,
              weekDayId: DAY_ID,
              date: "2026-03-10",
              mdTag: "MD-3",
              playerId: P3,
              playerDisplayName: "Player Three",
              tdPct: 20,
              hsrPct: 20,
              sprintPct: 20,
              accPct: 20,
              decPct: 20,
              tdBest: 9000,
              hsrBest: 700,
              sprintBest: 180,
              accBest: 35,
              decBest: 35,
              powerBiPlayerName: "P3",
              totalDistance: 1800,
              hsr: 140,
              sprint: 36,
              accelerations: 7,
              decelerations: 7,
              createdAt: "",
              updatedAt: "",
              createdBy: null,
              updatedBy: null,
            },
          };
        }
        return { ok: true, data: null };
      }
    );

    const result = await getDailyPlanForPrint({
      weekDayId: DAY_ID,
      playerIds: [P2, P1, P3],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.powerBiWeekId).toBe("4");
    expect(result.data.mdTag).toBe("MD-3");
    expect(result.data.date).toBe("2026-03-10");
    expect(result.data.players.map((p) => p.playerId)).toEqual([P2, P1, P3]);

    expect(result.data.players[0]).toMatchObject({
      playerId: P2,
      playerDisplayName: "Player Two",
      hasDailyTarget: false,
      totalDistance: null,
      hsr: null,
      sprint: null,
      accelerations: null,
      decelerations: null,
    });

    expect(result.data.players[1]).toMatchObject({
      playerId: P1,
      playerDisplayName: "Player One",
      hasDailyTarget: true,
      totalDistance: 4000.4,
      hsr: 400.5,
      sprint: 60.2,
      accelerations: 18.6,
      decelerations: 17.4,
    });

    expect(result.data.players[2].hasDailyTarget).toBe(true);
    expect(result.data.players[2].totalDistance).toBe(1800);

    // Missing daily target must not become 0 in Daily % / averages
    expect(result.data.dailyPct.td).toBe("Mixed");
    expect(result.data.teamAverage.totalDistance).toBeCloseTo(
      (4000.4 + 1800) / 2,
      5
    );
  });

  it("dedupes duplicate playerIds while preserving first-seen order", async () => {
    const calls: string[] = [];
    getPlannerDailyTarget.mockImplementation(
      async (_dayId: string, playerId: string) => {
        calls.push(playerId);
        if (playerId === P1) {
          return {
            ok: true,
            data: {
              weekId: WEEK_ID,
              weekDayId: DAY_ID,
              date: "2026-03-10",
              mdTag: "MD-3",
              playerId: P1,
              playerDisplayName: "Player One",
              tdPct: 40,
              hsrPct: 40,
              sprintPct: 40,
              accPct: 40,
              decPct: 40,
              tdBest: 10000,
              hsrBest: 800,
              sprintBest: 200,
              accBest: 40,
              decBest: 40,
              powerBiPlayerName: "P1",
              totalDistance: 4000,
              hsr: 320,
              sprint: 80,
              accelerations: 16,
              decelerations: 16,
              createdAt: "",
              updatedAt: "",
              createdBy: null,
              updatedBy: null,
            },
          };
        }
        if (playerId === P2) {
          return {
            ok: true,
            data: {
              weekId: WEEK_ID,
              weekDayId: DAY_ID,
              date: "2026-03-10",
              mdTag: "MD-3",
              playerId: P2,
              playerDisplayName: "Player Two",
              tdPct: 40,
              hsrPct: 40,
              sprintPct: 40,
              accPct: 40,
              decPct: 40,
              tdBest: 9000,
              hsrBest: 700,
              sprintBest: 180,
              accBest: 35,
              decBest: 35,
              powerBiPlayerName: "P2",
              totalDistance: 3600,
              hsr: 280,
              sprint: 72,
              accelerations: 14,
              decelerations: 14,
              createdAt: "",
              updatedAt: "",
              createdBy: null,
              updatedBy: null,
            },
          };
        }
        return { ok: true, data: null };
      }
    );

    const result = await getDailyPlanForPrint({
      weekDayId: DAY_ID,
      playerIds: [P1, P2, P1],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.players.map((p) => p.playerId)).toEqual([P1, P2]);
    expect(result.data.players).toHaveLength(2);
    expect(calls).toEqual([P1, P2]);
    expect(getPlannerWeeklyTarget).toHaveBeenCalledTimes(2);
  });

  it("rejects Player role", async () => {
    getAppUser.mockResolvedValue({ ...ADMIN, role: "player" });
    const result = await getDailyPlanForPrint({
      weekDayId: DAY_ID,
      playerIds: [P1],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unauthorized");
  });

  it("same daily % yields different absolutes per player Match Best chain", async () => {
    getPlannerDailyTarget.mockImplementation(
      async (_dayId: string, playerId: string) => {
        const base = {
          weekId: WEEK_ID,
          weekDayId: DAY_ID,
          date: "2026-03-10",
          mdTag: "MD-3",
          tdPct: 50,
          hsrPct: 50,
          sprintPct: 50,
          accPct: 50,
          decPct: 50,
          powerBiPlayerName: "X",
          createdAt: "",
          updatedAt: "",
          createdBy: null,
          updatedBy: null,
        };
        if (playerId === P1) {
          return {
            ok: true,
            data: {
              ...base,
              playerId: P1,
              playerDisplayName: "A",
              tdBest: 8000,
              hsrBest: 800,
              sprintBest: 100,
              accBest: 40,
              decBest: 40,
              totalDistance: 4000,
              hsr: 400,
              sprint: 50,
              accelerations: 20,
              decelerations: 20,
            },
          };
        }
        return {
          ok: true,
          data: {
            ...base,
            playerId: P2,
            playerDisplayName: "B",
            tdBest: 10000,
            hsrBest: 600,
            sprintBest: 200,
            accBest: 60,
            decBest: 60,
            totalDistance: 5000,
            hsr: 300,
            sprint: 100,
            accelerations: 30,
            decelerations: 30,
          },
        };
      }
    );

    const result = await getDailyPlanForPrint({
      weekDayId: DAY_ID,
      playerIds: [P1, P2],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.players[0].totalDistance).toBe(4000);
    expect(result.data.players[1].totalDistance).toBe(5000);
    expect(result.data.players[0].hsr).not.toBe(result.data.players[1].hsr);
    expect(result.data.dailyPct.td).toBe(50);
    expect(result.data.dailyPct.hsr).toBe(50);
  });

  it("weekly/daily % Mixed vs same; missing daily excluded from average", async () => {
    getPlannerWeeklyTarget.mockImplementation(
      async (_weekId: string, playerId: string) => {
        if (playerId === P1) {
          return {
            ok: true,
            data: weeklyView(P1, {
              tdPct: 230,
              hsrPct: 135,
              sprintPct: 115,
              accPct: 250,
              decPct: 225,
            }),
          };
        }
        if (playerId === P2) {
          return {
            ok: true,
            data: weeklyView(P2, {
              tdPct: 230,
              hsrPct: 100,
              sprintPct: 115,
              accPct: 250,
              decPct: 225,
            }),
          };
        }
        return { ok: true, data: null };
      }
    );

    getPlannerDailyTarget.mockImplementation(
      async (_dayId: string, playerId: string) => {
        if (playerId === P1) {
          return {
            ok: true,
            data: {
              weekId: WEEK_ID,
              weekDayId: DAY_ID,
              date: "2026-03-10",
              mdTag: "MD-3",
              playerId: P1,
              playerDisplayName: "A",
              tdPct: 55,
              hsrPct: 50,
              sprintPct: 40,
              accPct: 45,
              decPct: 45,
              tdBest: 10000,
              hsrBest: 800,
              sprintBest: 200,
              accBest: 40,
              decBest: 40,
              powerBiPlayerName: "A",
              totalDistance: 5000,
              hsr: 100,
              sprint: 40,
              accelerations: 20,
              decelerations: 20,
              createdAt: "",
              updatedAt: "",
              createdBy: null,
              updatedBy: null,
            },
          };
        }
        if (playerId === P2) {
          return {
            ok: true,
            data: {
              weekId: WEEK_ID,
              weekDayId: DAY_ID,
              date: "2026-03-10",
              mdTag: "MD-3",
              playerId: P2,
              playerDisplayName: "B",
              tdPct: 55,
              hsrPct: 40,
              sprintPct: 40,
              accPct: 45,
              decPct: 45,
              tdBest: 10000,
              hsrBest: 800,
              sprintBest: 200,
              accBest: 40,
              decBest: 40,
              powerBiPlayerName: "B",
              totalDistance: 7000,
              hsr: 200,
              sprint: 80,
              accelerations: 30,
              decelerations: 30,
              createdAt: "",
              updatedAt: "",
              createdBy: null,
              updatedBy: null,
            },
          };
        }
        return { ok: true, data: null };
      }
    );

    const result = await getDailyPlanForPrint({
      weekDayId: DAY_ID,
      playerIds: [P1, P2, P3],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.weeklyPct.td).toBe(230);
    expect(result.data.weeklyPct.hsr).toBe("Mixed");
    expect(result.data.weeklyPct.sprint).toBe(115);
    expect(result.data.dailyPct.td).toBe(55);
    expect(result.data.dailyPct.hsr).toBe("Mixed");
    expect(result.data.dailyPct.sprint).toBe(40);
    expect(result.data.teamAverage.totalDistance).toBe(6000);
    expect(result.data.teamAverage.hsr).toBe(150);
    expect(result.data.players[2].hasDailyTarget).toBe(false);
    expect(result.data.players[2].hsr).toBeNull();
  });

  it("shows — summaries when no printed player has targets", async () => {
    getPlannerWeeklyTarget.mockResolvedValue({ ok: true, data: null });
    getPlannerDailyTarget.mockResolvedValue({ ok: true, data: null });

    const result = await getDailyPlanForPrint({
      weekDayId: DAY_ID,
      playerIds: [P2],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.weeklyPct.td).toBeNull();
    expect(result.data.dailyPct.td).toBeNull();
    expect(result.data.teamAverage.totalDistance).toBeNull();
  });

  it("does not call Power BI Actual or Planner progress paths", async () => {
    getPlannerDailyTarget.mockResolvedValue({
      ok: true,
      data: {
        weekId: WEEK_ID,
        weekDayId: DAY_ID,
        date: "2026-03-10",
        mdTag: "MD-3",
        playerId: P1,
        playerDisplayName: "Player One",
        tdPct: 40,
        hsrPct: 40,
        sprintPct: 40,
        accPct: 40,
        decPct: 40,
        tdBest: 10000,
        hsrBest: 800,
        sprintBest: 200,
        accBest: 40,
        decBest: 40,
        powerBiPlayerName: "P1",
        totalDistance: 4000,
        hsr: 320,
        sprint: 80,
        accelerations: 16,
        decelerations: 16,
        createdAt: "",
        updatedAt: "",
        createdBy: null,
        updatedBy: null,
      },
    });

    const result = await getDailyPlanForPrint({
      weekDayId: DAY_ID,
      playerIds: [P1],
    });

    expect(result.ok).toBe(true);
    expect(getTrainingActualGps).not.toHaveBeenCalled();
    expect(getPlannerWeeklyProgress).not.toHaveBeenCalled();
    expect(getPlannerDailyAnalysis).not.toHaveBeenCalled();
  });

  it("loads historical week day via persisted planner_week_days + targets only", async () => {
    stubDayAndProfiles({
      day: {
        id: DAY_ID,
        week_id: WEEK_ID,
        date: "2026-01-15",
        md_tag: "MD-2",
      },
    });
    getPlannerWeek.mockResolvedValue({
      ok: true,
      data: {
        id: WEEK_ID,
        powerbiWeekId: "4",
        startDate: "2026-01-12",
        endDate: "2026-01-18",
        weekType: "maintaining",
        overloadFocus: [],
        status: "closed",
        createdBy: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    });
    getPlannerWeeklyTarget.mockResolvedValue({
      ok: true,
      data: weeklyView(P1, {
        tdPct: 200,
        hsrPct: 120,
        sprintPct: 100,
        accPct: 200,
        decPct: 200,
      }),
    });
    getPlannerDailyTarget.mockResolvedValue({
      ok: true,
      data: {
        weekId: WEEK_ID,
        weekDayId: DAY_ID,
        date: "2026-01-15",
        mdTag: "MD-2",
        playerId: P1,
        playerDisplayName: "Historical Player",
        tdPct: 40,
        hsrPct: 40,
        sprintPct: 40,
        accPct: 40,
        decPct: 40,
        tdBest: 10000,
        hsrBest: 800,
        sprintBest: 200,
        accBest: 40,
        decBest: 40,
        powerBiPlayerName: "P1",
        totalDistance: 4000,
        hsr: 320,
        sprint: 80,
        accelerations: 16,
        decelerations: 16,
        createdAt: "",
        updatedAt: "",
        createdBy: null,
        updatedBy: null,
      },
    });

    const result = await getDailyPlanForPrint({
      weekDayId: DAY_ID,
      playerIds: [P1],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.powerBiWeekId).toBe("4");
    expect(result.data.mdTag).toBe("MD-2");
    expect(result.data.date).toBe("2026-01-15");
    expect(result.data.weeklyPct.td).toBe(200);
    expect(result.data.dailyPct.td).toBe(40);
    expect(getTrainingActualGps).not.toHaveBeenCalled();
  });
});

describe("Daily Plan print display rounding", () => {
  it("rounds for display only without inventing zeros for null", async () => {
    const { formatPlannerDisplayAbsolute } = await import(
      "@/lib/gpsPlanner/uiDisplay"
    );
    expect(formatPlannerDisplayAbsolute(4000.4)).toBe(4000);
    expect(formatPlannerDisplayAbsolute(400.5)).toBe(401);
    expect(formatPlannerDisplayAbsolute(18.6)).toBe(19);
    expect(formatPlannerDisplayAbsolute(6000.5)).toBe(6001);
  });
});

describe("Daily Plan print content / design contract", () => {
  it("uses landscape A4, simple headers, and secondary summaries", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const viewPath = path.join(
      process.cwd(),
      "app/(app)/admin/planner/daily-plan/DailyPlanPrintView.tsx"
    );
    const source = await fs.readFile(viewPath, "utf8");
    expect(source).toContain("Daily Plan");
    expect(source).toContain("size: A4 landscape");
    expect(source).toContain(">Player</");
    expect(source).toContain(">TD</");
    expect(source).toContain(">HSR</");
    expect(source).toContain(">Sprint</");
    expect(source).toContain(">Acc</");
    expect(source).toContain(">Dec</");
    expect(source).not.toContain("TD (m)");
    expect(source).not.toContain("HSR (m)");
    expect(source).not.toContain("Sprint (m)");
    expect(source).not.toContain("Acc (count)");
    expect(source).not.toContain("Dec (count)");
    expect(source).toContain("Weekly %");
    expect(source).toContain("Daily %");
    expect(source).toContain("Daily Team Average");
    expect(source).toContain("daily-plan-print-pct-pair");
    expect(source).toContain("PRINT_BURGUNDY");
    expect(source).toContain("Power BI calculations");
    expect(source).toContain("daily-plan-print-attribution");
    expect(source).toContain("formatPlanDate");
    expect(source).toContain("formatMatchdayMeta");
    expect(source).toContain('return `MD${t.slice(2)}`');
    expect(source).not.toContain("Matchday ${");
    expect(source).not.toContain("`Matchday");
    expect(source).toContain("no-print");
    expect(source).toContain("daily-plan-print-logo");
    expect(source).toContain("text-align: center");
    expect(source).toContain("opacity: 0.92");
    for (const forbidden of [
      "Match Best",
      "To Target",
      "Remaining to Allocate",
      "Wellness",
      "source_method",
      "Difference",
      "lucide-react",
      "No Daily Target",
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).not.toMatch(/\bActual\b/);
  });
});
