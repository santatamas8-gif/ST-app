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

const getPlannerWeekOfficialMatches = vi.fn();
vi.mock("@/lib/gpsPlanner/weekMatches.server", () => ({
  getPlannerWeekOfficialMatches: (...args: unknown[]) =>
    getPlannerWeekOfficialMatches(...args),
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

const getMatchCandidateDates = vi.fn();
vi.mock("@/lib/powerbi/queries/matchCandidates.server", () => ({
  getMatchCandidateDates: (...args: unknown[]) => getMatchCandidateDates(...args),
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
    getPlannerWeekOfficialMatches.mockReset();
    getPlannerWeeklyReviewProgress.mockReset();
    getMatchActualGpsBatch.mockReset();
    getMatchCandidateDates.mockReset();
    getPlayerMapping.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
    getPlannerWeek.mockResolvedValue({ ok: true, data: WEEK });
    getMatchCandidateDates.mockResolvedValue({
      ok: true,
      candidates: [
        { gpsDate: "2026-08-15", rawRowCount: 22, distinctPlayerCount: 11 },
      ],
    });
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
    getPlannerWeekOfficialMatches.mockResolvedValue({ ok: true, data: [OFFICIAL] });

    const result = await getPlannerTotalLoad(WEEK_ID);
    expect(result.ok).toBe(true);
    expect(getPlannerWeeklyReviewProgress).toHaveBeenCalledWith({
      weekId: WEEK_ID,
      throughDate: "2026-08-14",
    });
  });

  it("empty Weekly Target population does not call Training extras or Match Power BI", async () => {
    getPlannerWeeklyReviewProgress.mockResolvedValue({ ok: true, data: [] });
    getPlannerWeekOfficialMatches.mockResolvedValue({ ok: true, data: [OFFICIAL] });

    const result = await getPlannerTotalLoad(WEEK_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.rows).toEqual([]);
    expect(getMatchActualGpsBatch).not.toHaveBeenCalled();
    expect(getMatchCandidateDates).not.toHaveBeenCalled();
    expect(getPlayerMapping).not.toHaveBeenCalled();
  });

  it("does not call Match Power BI when official match is absent", async () => {
    getPlannerWeeklyReviewProgress.mockResolvedValue({
      ok: true,
      data: [trainingRow("Doru Andrei", "Doru Andrei")],
    });
    getPlannerWeekOfficialMatches.mockResolvedValue({ ok: true, data: [] });

    const result = await getPlannerTotalLoad(WEEK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.officialMatch.selected).toBe(false);
    expect(result.data.rows[0].quality).toBe("match_not_selected");
    expect(getMatchActualGpsBatch).not.toHaveBeenCalled();
    expect(getMatchCandidateDates).not.toHaveBeenCalled();
  });

  it("calls Match batch once with frozen snapshot names, powerbi week id, and gps_date", async () => {
    const liveMappingName = "Current Mapped Name";
    getPlannerWeeklyReviewProgress.mockResolvedValue({
      ok: true,
      data: [trainingRow("Doru Andrei", "Doru Andrei Frozen")],
    });
    getPlannerWeekOfficialMatches.mockResolvedValue({ ok: true, data: [OFFICIAL] });
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
    expect(getMatchCandidateDates).toHaveBeenCalledTimes(1);
    expect(getMatchCandidateDates).toHaveBeenCalledWith({ weekId: "W5" });
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
    getPlannerWeekOfficialMatches.mockResolvedValue({ ok: true, data: [OFFICIAL] });
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

  it("E: pending configured Match skips Match Actual batch", async () => {
    getPlannerWeeklyReviewProgress.mockResolvedValue({
      ok: true,
      data: [trainingRow("Doru Andrei", "Doru Andrei")],
    });
    getPlannerWeekOfficialMatches.mockResolvedValue({ ok: true, data: [OFFICIAL] });
    getMatchCandidateDates.mockResolvedValue({
      ok: true,
      candidates: [
        { gpsDate: "2026-08-10", rawRowCount: 20, distinctPlayerCount: 10 },
      ],
    });

    const result = await getPlannerTotalLoad(WEEK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(getMatchCandidateDates).toHaveBeenCalledTimes(1);
    expect(getMatchActualGpsBatch).not.toHaveBeenCalled();
    expect(result.data.rows[0].quality).toBe("match_data_pending");
    expect(result.data.rows[0].matches[0].state).toBe("match_data_pending");
    expect(result.data.rows[0].matches[0].state).not.toBe("match_zero");
    expect(result.data.rows[0].total.metrics).toBeNull();
  });

  it("F: candidate query failure is match_query_error, not pending or zero", async () => {
    getPlannerWeeklyReviewProgress.mockResolvedValue({
      ok: true,
      data: [trainingRow("Doru Andrei", "Doru Andrei")],
    });
    getPlannerWeekOfficialMatches.mockResolvedValue({ ok: true, data: [OFFICIAL] });
    getMatchCandidateDates.mockResolvedValue({
      ok: false,
      error: { code: "timeout", message: "Power BI request timed out." },
    });

    const result = await getPlannerTotalLoad(WEEK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(getMatchActualGpsBatch).not.toHaveBeenCalled();
    expect(result.data.rows[0].match.quality).toBe("match_query_error");
    expect(result.data.rows[0].quality).toBe("unsafe");
    expect(result.data.rows[0].matches[0].state).not.toBe("match_data_pending");
    expect(result.data.rows[0].matches[0].state).not.toBe("match_zero");
    expect(result.data.rows[0].total.metrics).toBeNull();
  });

  it("two configured Matches: 1 candidate + 2 batches; one pending of two: 1 candidate + 1 batch", async () => {
    const match2 = {
      ...OFFICIAL,
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      gpsDate: "2026-08-18",
      matchOrder: 2 as const,
    };
    getPlannerWeeklyReviewProgress.mockResolvedValue({
      ok: true,
      data: [trainingRow("Doru Andrei", "Doru Andrei")],
    });
    getPlannerWeekOfficialMatches.mockResolvedValue({
      ok: true,
      data: [OFFICIAL, match2],
    });
    getMatchCandidateDates.mockResolvedValue({
      ok: true,
      candidates: [
        { gpsDate: "2026-08-15", rawRowCount: 22, distinctPlayerCount: 11 },
        { gpsDate: "2026-08-18", rawRowCount: 20, distinctPlayerCount: 10 },
      ],
    });
    getMatchActualGpsBatch.mockResolvedValue({
      ok: true,
      byPlayerName: new Map([
        [
          "Doru Andrei",
          {
            playerName: "Doru Andrei",
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

    const both = await getPlannerTotalLoad(WEEK_ID);
    expect(both.ok).toBe(true);
    expect(getMatchCandidateDates).toHaveBeenCalledTimes(1);
    expect(getMatchActualGpsBatch).toHaveBeenCalledTimes(2);

    getMatchCandidateDates.mockClear();
    getMatchActualGpsBatch.mockClear();
    getMatchCandidateDates.mockResolvedValue({
      ok: true,
      candidates: [
        { gpsDate: "2026-08-15", rawRowCount: 22, distinctPlayerCount: 11 },
      ],
    });
    const mixed = await getPlannerTotalLoad(WEEK_ID);
    expect(mixed.ok).toBe(true);
    if (!mixed.ok) return;
    expect(getMatchCandidateDates).toHaveBeenCalledTimes(1);
    expect(getMatchActualGpsBatch).toHaveBeenCalledTimes(1);
    expect(getMatchActualGpsBatch).toHaveBeenCalledWith({
      weekId: "W5",
      gpsDate: "2026-08-15",
      playerNames: ["Doru Andrei"],
    });
    expect(mixed.data.rows[0].quality).toBe("match_data_pending");
    expect(mixed.data.rows[0].total.metrics).toBeNull();
    expect(mixed.data.rows[0].matches[0].state).toBe("match_zero");
    expect(mixed.data.rows[0].matches[1].state).toBe("match_data_pending");
  });

  it("W5 single-match parity: Training + Match 1, frozen names, 1-Match Best %", async () => {
    getPlannerWeeklyReviewProgress.mockResolvedValue({
      ok: true,
      data: [trainingRow("Doru Andrei", "Doru Andrei Frozen")],
    });
    getPlannerWeekOfficialMatches.mockResolvedValue({ ok: true, data: [OFFICIAL] });
    getMatchActualGpsBatch.mockResolvedValue({
      ok: true,
      byPlayerName: new Map([
        [
          "Doru Andrei Frozen",
          {
            playerName: "Doru Andrei Frozen",
            quality: "match_ok",
            halves: { first: "valid", second: "valid" },
            metrics: {
              totalDistance: 5000,
              hsr: 50,
              sprint: 10,
              accelerations: 5,
              decelerations: 6,
              durationSeconds: 5480,
            },
          },
        ],
      ]),
    });

    const result = await getPlannerTotalLoad(WEEK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const player = result.data.rows[0];
    expect(player.quality).toBe("complete");
    expect(player.total.metrics).toEqual({
      totalDistance: 19000,
      hsr: 150,
      sprint: 30,
      accelerations: 15,
      decelerations: 17,
    });
    expect(player.total.percentages?.totalDistance).toBe((19000 / 20000) * 100);
    expect(player.match.durationSeconds).toBe(5480);
    expect(getMatchCandidateDates).toHaveBeenCalledTimes(1);
    expect(getMatchActualGpsBatch).toHaveBeenCalledTimes(1);
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
    expect(src).toContain("getPlannerWeekOfficialMatches");
    expect(src).not.toContain("getPlannerWeekOfficialMatch(");
    expect(src).toContain("getMatchCandidateDates");
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
