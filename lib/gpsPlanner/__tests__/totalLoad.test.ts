import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

vi.mock("server-only", () => ({}));

const getAppUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getAppUser: (...args: unknown[]) => getAppUser(...args),
  isAdmin: (role: string) => role === "admin",
}));

const getPlannerWeek = vi.fn();
vi.mock("@/lib/gpsPlanner/weeks.server", () => ({
  getPlannerWeek: (...args: unknown[]) => getPlannerWeek(...args),
}));

const getPlannerWeekOfficialMatch = vi.fn();
vi.mock("@/lib/gpsPlanner/weekMatches.server", () => ({
  getPlannerWeekOfficialMatch: (...args: unknown[]) =>
    getPlannerWeekOfficialMatch(...args),
}));

const getPlannerWeeklyReviewProgress = vi.fn();
vi.mock("@/lib/gpsPlanner/progress.server", () => ({
  getPlannerWeeklyReviewProgress: (...args: unknown[]) =>
    getPlannerWeeklyReviewProgress(...args),
}));

const getMatchActualGpsBatch = vi.fn();
vi.mock("@/lib/powerbi/queries/matchActual.server", () => ({
  getMatchActualGpsBatch: (...args: unknown[]) => getMatchActualGpsBatch(...args),
}));

const getPlayerMapping = vi.fn();
vi.mock("@/lib/gpsPlanner/playerMappings.server", () => ({
  getPlayerMapping: (...args: unknown[]) => getPlayerMapping(...args),
}));

import { getPlannerTotalLoad } from "@/lib/gpsPlanner/totalLoad.server";
import type { PlannerWeeklyProgressResult } from "@/lib/gpsPlanner/types";

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

const WEEK = {
  id: WEEK_ID,
  powerbiWeekId: "W5",
  startDate: "2026-08-10",
  endDate: "2026-08-14",
  weekType: "maintaining" as const,
  overloadFocus: [],
  status: "active" as const,
  createdBy: null,
  createdAt: "",
  updatedAt: "",
};

const OFFICIAL = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  weekId: WEEK_ID,
  gpsDate: "2026-08-15",
  matchOrder: 1 as const,
  mdTag: "MD",
  opponent: "FK Csikszereda",
  matchday: "Matchday 5",
  competition: null,
  createdBy: null,
  updatedBy: null,
  createdAt: "",
  updatedAt: "",
};

function trainingRow(
  name: string,
  pbiName: string
): PlannerWeeklyProgressResult {
  return {
    weekId: WEEK_ID,
    powerBiWeekId: "W5",
    playerId: PLAYER_ID,
    playerDisplayName: name,
    throughDate: "2026-08-14",
    frozen: {
      tdBest: 20000,
      hsrBest: 800,
      sprintBest: 200,
      accBest: 40,
      decBest: 40,
      powerBiPlayerName: pbiName,
      sourceMethod: "single-match best",
    },
    weeklyPct: { tdPct: 80, hsrPct: 80, sprintPct: 80, accPct: 80, decPct: 80 },
    weeklyPlanned: {
      totalDistance: 16000,
      hsr: 640,
      sprint: 160,
      accelerations: 32,
      decelerations: 32,
    },
    dailyAllocationSum: {
      tdPct: 0,
      hsrPct: 0,
      sprintPct: 0,
      accPct: 0,
      decPct: 0,
    },
    remainingToAllocate: {
      tdPct: 80,
      hsrPct: 80,
      sprintPct: 80,
      accPct: 80,
      decPct: 80,
    },
    days: [],
    includedDays: 5,
    foundDays: 5,
    notFoundDays: 0,
    problematicDays: 0,
    weeklyActual: {
      totalDistance: 14000,
      hsr: 100,
      sprint: 20,
      accelerations: 10,
      decelerations: 11,
    },
    weeklyToTarget: null,
    actualCompleteness: "complete",
  };
}

describe("getPlannerTotalLoad", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    getPlannerWeek.mockReset();
    getPlannerWeekOfficialMatch.mockReset();
    getPlannerWeeklyReviewProgress.mockReset();
    getMatchActualGpsBatch.mockReset();
    getPlayerMapping.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
    getPlannerWeek.mockResolvedValue({ ok: true, data: WEEK });
  });

  it("rejects staff and player", async () => {
    getAppUser.mockResolvedValue(STAFF);
    const staff = await getPlannerTotalLoad(WEEK_ID);
    expect(staff.ok).toBe(false);
    if (!staff.ok) expect(staff.error.code).toBe("unauthorized");

    getAppUser.mockResolvedValue(PLAYER);
    const player = await getPlannerTotalLoad(WEEK_ID);
    expect(player.ok).toBe(false);
    expect(getPlannerWeeklyReviewProgress).not.toHaveBeenCalled();
    expect(getMatchActualGpsBatch).not.toHaveBeenCalled();
    expect(getPlannerWeek).not.toHaveBeenCalled();
  });

  it("uses Weekly Target population via Weekly Review and throughDate = week.end_date", async () => {
    getPlannerWeeklyReviewProgress.mockResolvedValue({ ok: true, data: [] });
    getPlannerWeekOfficialMatch.mockResolvedValue({ ok: true, data: OFFICIAL });

    const result = await getPlannerTotalLoad(WEEK_ID);
    expect(result.ok).toBe(true);
    expect(getPlannerWeeklyReviewProgress).toHaveBeenCalledWith({
      weekId: WEEK_ID,
      throughDate: "2026-08-14",
    });
  });

  it("empty Weekly Target population does not call Training extras or Match Power BI", async () => {
    getPlannerWeeklyReviewProgress.mockResolvedValue({ ok: true, data: [] });
    getPlannerWeekOfficialMatch.mockResolvedValue({ ok: true, data: OFFICIAL });

    const result = await getPlannerTotalLoad(WEEK_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.rows).toEqual([]);
    expect(getMatchActualGpsBatch).not.toHaveBeenCalled();
    expect(getPlayerMapping).not.toHaveBeenCalled();
  });

  it("does not call Match Power BI when official match is absent", async () => {
    getPlannerWeeklyReviewProgress.mockResolvedValue({
      ok: true,
      data: [trainingRow("Doru Andrei", "Doru Andrei")],
    });
    getPlannerWeekOfficialMatch.mockResolvedValue({ ok: true, data: null });

    const result = await getPlannerTotalLoad(WEEK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.officialMatch.selected).toBe(false);
    expect(result.data.rows[0].quality).toBe("match_not_selected");
    expect(getMatchActualGpsBatch).not.toHaveBeenCalled();
  });

  it("calls Match batch once with frozen snapshot names, powerbi week id, and gps_date", async () => {
    const liveMappingName = "Current Mapped Name";
    getPlannerWeeklyReviewProgress.mockResolvedValue({
      ok: true,
      data: [trainingRow("Doru Andrei", "Doru Andrei Frozen")],
    });
    getPlannerWeekOfficialMatch.mockResolvedValue({ ok: true, data: OFFICIAL });
    getMatchActualGpsBatch.mockResolvedValue({
      ok: true,
      byPlayerName: new Map([
        [
          "Doru Andrei Frozen",
          {
            playerName: "Doru Andrei Frozen",
            quality: "match_zero",
            halves: { first: "absent", second: "absent" },
            metrics: {
              totalDistance: 0,
              hsr: 0,
              sprint: 0,
              accelerations: 0,
              decelerations: 0,
              durationSeconds: 0,
            },
          },
        ],
      ]),
    });

    const result = await getPlannerTotalLoad(WEEK_ID);
    expect(result.ok).toBe(true);
    expect(getMatchActualGpsBatch).toHaveBeenCalledTimes(1);
    expect(getMatchActualGpsBatch).toHaveBeenCalledWith({
      weekId: "W5",
      gpsDate: "2026-08-15",
      playerNames: ["Doru Andrei Frozen"],
    });
    expect(getMatchActualGpsBatch.mock.calls[0][0].playerNames).not.toContain(
      liveMappingName
    );
    expect(getPlayerMapping).not.toHaveBeenCalled();
  });

  it("Match query error is not match_zero for the population", async () => {
    getPlannerWeeklyReviewProgress.mockResolvedValue({
      ok: true,
      data: [trainingRow("Doru Andrei", "Doru Andrei")],
    });
    getPlannerWeekOfficialMatch.mockResolvedValue({ ok: true, data: OFFICIAL });
    getMatchActualGpsBatch.mockResolvedValue({
      ok: false,
      error: { code: "timeout", message: "Power BI request timed out." },
    });

    const result = await getPlannerTotalLoad(WEEK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rows[0].match.quality).toBe("match_query_error");
    expect(result.data.rows[0].quality).toBe("unsafe");
    expect(result.data.rows[0].total.metrics).toBeNull();
    expect(result.data.rows[0].training.metrics?.totalDistance).toBe(14000);
  });

  it("does not import or persist Total Load GPS Actuals", async () => {
    const src = await readFile(
      path.join(process.cwd(), "lib/gpsPlanner/totalLoad.server.ts"),
      "utf8"
    );
    expect(src).not.toContain(".insert(");
    expect(src).not.toContain(".update(");
    expect(src).not.toContain(".upsert(");
    expect(src).not.toContain("player_external_mappings");
    expect(src).toContain("throughDate: week.endDate");
  });
});

describe("Phase 3 isolation", () => {
  it("does not modify Training Actual or Match Actual Phase 2 modules", async () => {
    const training = await readFile(
      path.join(process.cwd(), "lib/powerbi/queries/trainingActual.server.ts"),
      "utf8"
    );
    const match = await readFile(
      path.join(process.cwd(), "lib/powerbi/queries/matchActual.server.ts"),
      "utf8"
    );
    expect(training).toContain('FULL_TRAINING_DRILL = "Full Training"');
    expect(training).not.toContain("getPlannerTotalLoad");
    expect(match).toContain("getMatchActualGpsBatch");
    expect(match).not.toContain("getPlannerTotalLoad");
    expect(match).not.toContain("totalLoad");
  });
});
