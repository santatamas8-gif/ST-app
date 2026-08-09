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
  getPlannerDailyAnalysis: (...args: unknown[]) =>
    getPlannerDailyAnalysis(...args),
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

describe("getDailyPlanForPrint", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    getPlannerDailyTarget.mockReset();
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
        powerbiWeekId: "W6",
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

    expect(result.data.powerBiWeekId).toBe("W6");
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
});

describe("Daily Plan print display rounding", () => {
  it("rounds for display only without inventing zeros for null", async () => {
    const { formatPlannerDisplayAbsolute } = await import(
      "@/lib/gpsPlanner/uiDisplay"
    );
    expect(formatPlannerDisplayAbsolute(4000.4)).toBe(4000);
    expect(formatPlannerDisplayAbsolute(400.5)).toBe(401);
    expect(formatPlannerDisplayAbsolute(18.6)).toBe(19);
  });
});

describe("Daily Plan print content contract", () => {
  it("exposes only coaching sheet fields (no Actual / Match Best / %)", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const viewPath = path.join(
      process.cwd(),
      "app/(app)/admin/planner/daily-plan/DailyPlanPrintView.tsx"
    );
    const source = await fs.readFile(viewPath, "utf8");
    expect(source).toContain("Daily Plan");
    expect(source).toContain("TD (m)");
    expect(source).toContain("HSR (m)");
    expect(source).toContain("Sprint (m)");
    expect(source).toContain("Acc (count)");
    expect(source).toContain("Dec (count)");
    for (const forbidden of [
      "Match Best",
      "Weekly %",
      "Daily %",
      "To Target",
      "Remaining to Allocate",
      "Wellness",
      "source_method",
      "Difference",
    ]) {
      expect(source).not.toContain(forbidden);
    }
    // "Actual" must not appear as a column/label (allow only in comments if any)
    expect(source).not.toMatch(/\bActual\b/);
  });
});
