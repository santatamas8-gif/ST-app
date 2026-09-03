import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

vi.mock("server-only", () => ({}));

const executePowerBiDaxQuery = vi.fn();

vi.mock("@/lib/powerbi/client.server", () => ({
  executePowerBiDaxQuery: (...args: unknown[]) => executePowerBiDaxQuery(...args),
}));

import {
  buildTrainingActualBatchDax,
  buildTrainingActualDax,
  buildTrainingDrillDaxPredicate,
  getTrainingActualGps,
  getTrainingActualGpsBatchForDay,
} from "@/lib/powerbi/queries/trainingActual.server";

function okRows(rows: Record<string, unknown>[]) {
  return {
    ok: true as const,
    results: [{ tables: [{ rows }] }],
  };
}

const FT_METRICS = {
  "[Drill]": "Full Training",
  "[TD]": 6584.95,
  "[Z5]": 632.07,
  "[Z6]": 271.5,
  "[Acc]": 65,
  "[Dec]": 59,
};

describe("buildTrainingDrillDaxPredicate", () => {
  it("uses Full Training only before 2026-09-01", () => {
    expect(buildTrainingDrillDaxPredicate("2026-08-31")).toBe(
      'GPS_Log[Drill] = "Full Training"'
    );
    expect(buildTrainingDrillDaxPredicate(undefined)).toBe(
      'GPS_Log[Drill] = "Full Training"'
    );
  });

  it("allows Full Training and Individual from 2026-09-01", () => {
    expect(buildTrainingDrillDaxPredicate("2026-09-01")).toBe(
      'GPS_Log[Drill] IN {"Full Training", "Individual"}'
    );
  });
});

describe("DAX builders share cutoff semantics", () => {
  it("single-player and batch builders use the same drill predicate", () => {
    const preSingle = buildTrainingActualDax({
      weekId: "W8",
      mdTag: "MD-3",
      playerName: "Carl Davordzie",
      dateParts: { year: 2026, month: 8, day: 31 },
      isoDate: "2026-08-31",
    });
    const preBatch = buildTrainingActualBatchDax({
      weekId: "W8",
      mdTag: "MD-3",
      playerNames: ["Carl Davordzie"],
      dateParts: { year: 2026, month: 8, day: 31 },
    });
    expect(preSingle).toContain('GPS_Log[Drill] = "Full Training"');
    expect(preBatch).toContain('GPS_Log[Drill] = "Full Training"');
    expect(preSingle).not.toContain('GPS_Log[Drill] IN {');
    expect(preBatch).not.toContain('GPS_Log[Drill] IN {');
    expect(preSingle).toContain('"Drill", GPS_Log[Drill]');
    expect(preBatch).toContain('"Drill", GPS_Log[Drill]');

    const postSingle = buildTrainingActualDax({
      weekId: "W9",
      mdTag: "MD",
      playerName: "Carl Davordzie",
      dateParts: { year: 2026, month: 9, day: 1 },
      isoDate: "2026-09-01",
    });
    const postBatch = buildTrainingActualBatchDax({
      weekId: "W9",
      mdTag: "MD",
      playerNames: ["Carl Davordzie"],
      dateParts: { year: 2026, month: 9, day: 1 },
    });
    const allowlist = 'GPS_Log[Drill] IN {"Full Training", "Individual"}';
    expect(postSingle).toContain(allowlist);
    expect(postBatch).toContain(allowlist);
    expect(postSingle).not.toContain('GPS_Log[Drill] = "Full Training"');
    expect(postBatch).not.toContain('GPS_Log[Drill] = "Full Training"');
  });

  it("does not include unsupported drill aliases or report slicers", () => {
    const dax = buildTrainingActualDax({
      weekId: "W9",
      mdTag: "MD-1",
      playerName: "X",
      dateParts: { year: 2026, month: 9, day: 1 },
      isoDate: "2026-09-01",
    });
    expect(dax).not.toContain("Top Up");
    expect(dax).not.toContain('"individual"');
    expect(dax).not.toContain("Individual ");
    expect(dax).not.toContain("First Half");
    expect(dax).not.toContain("Second Half");
    expect(dax).not.toContain("Training_Drill_Switch");
    expect(dax).not.toContain('SessionType = "Individual"');
    expect(dax).not.toContain("1st Half");
    expect(dax).not.toContain("2nd Half");
  });
});

describe("getTrainingActualGps", () => {
  beforeEach(() => {
    executePowerBiDaxQuery.mockReset();
  });

  it("2026-08-31 Full Training → found", async () => {
    executePowerBiDaxQuery.mockResolvedValue(okRows([FT_METRICS]));

    const result = await getTrainingActualGps({
      weekId: "W8",
      mdTag: "MD-3",
      playerName: "Carl Davordzie",
      date: "2026-08-31",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        totalDistance: 6584.95,
        hsr: 632.07,
        sprint: 271.5,
        accelerations: 65,
        decelerations: 59,
      },
    });

    const dax = executePowerBiDaxQuery.mock.calls[0][0] as string;
    expect(dax).toContain('GPS_Log[Drill] = "Full Training"');
    expect(dax).not.toContain('GPS_Log[Drill] IN {');
    expect(dax).toContain("GPS_Log[Date] = DATE(2026,8,31)");
    expect(dax).not.toContain("SourceFile");
  });

  it("2026-08-31 Individual is excluded by DAX", async () => {
    executePowerBiDaxQuery.mockResolvedValue(okRows([]));
    const result = await getTrainingActualGps({
      weekId: "W8",
      mdTag: "MD-3",
      playerName: "Carl Davordzie",
      date: "2026-08-31",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
    const dax = executePowerBiDaxQuery.mock.calls[0][0] as string;
    expect(dax).toContain('GPS_Log[Drill] = "Full Training"');
    expect(dax).not.toContain('"Individual"');
  });

  it("2026-09-01 Full Training → found", async () => {
    executePowerBiDaxQuery.mockResolvedValue(
      okRows([{ ...FT_METRICS, Drill: "Full Training" }])
    );
    const result = await getTrainingActualGps({
      weekId: "W9",
      mdTag: "MD-4",
      playerName: "Carl Davordzie",
      date: "2026-09-01",
    });
    expect(result.ok).toBe(true);
    const dax = executePowerBiDaxQuery.mock.calls[0][0] as string;
    expect(dax).toContain('GPS_Log[Drill] IN {"Full Training", "Individual"}');
  });

  it("2026-09-01 Individual → found", async () => {
    executePowerBiDaxQuery.mockResolvedValue(
      okRows([
        {
          Drill: "Individual",
          TD: 1100,
          Z5: 20,
          Z6: 3,
          Acc: 4,
          Dec: 5,
        },
      ])
    );
    const result = await getTrainingActualGps({
      weekId: "W9",
      mdTag: "MD",
      playerName: "Rehab Player",
      date: "2026-09-01",
    });
    expect(result).toEqual({
      ok: true,
      data: {
        totalDistance: 1100,
        hsr: 20,
        sprint: 3,
        accelerations: 4,
        decelerations: 5,
      },
    });
    const dax = executePowerBiDaxQuery.mock.calls[0][0] as string;
    expect(dax).toContain('GPS_Log[MD_Tag] = "MD"');
    expect(dax).toContain('GPS_Log[Drill] IN {"Full Training", "Individual"}');
  });

  it("returns not_found when no allowed-drill rows match (not zero)", async () => {
    executePowerBiDaxQuery.mockResolvedValue(okRows([]));

    const result = await getTrainingActualGps({
      weekId: "W4",
      mdTag: "MD-3",
      playerName: "Unknown Player",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "not_found",
        message:
          "No training GPS row matched the given player, week, and MD tag.",
      },
    });
  });

  it("returns ambiguous when Full Training and Individual both exist", async () => {
    executePowerBiDaxQuery.mockResolvedValue(
      okRows([
        { Drill: "Full Training", TD: 100, Z5: 1, Z6: 1, Acc: 1, Dec: 1 },
        { Drill: "Individual", TD: 200, Z5: 2, Z6: 2, Acc: 2, Dec: 2 },
      ])
    );

    const result = await getTrainingActualGps({
      weekId: "W9",
      mdTag: "MD-3",
      playerName: "Carl Davordzie",
      date: "2026-09-01",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ambiguous");
    }
  });

  it("returns ambiguous when multiple Full Training rows match", async () => {
    executePowerBiDaxQuery.mockResolvedValue(
      okRows([
        { Drill: "Full Training", TD: 100, Z5: 1, Z6: 1, Acc: 1, Dec: 1 },
        { Drill: "Full Training", TD: 200, Z5: 2, Z6: 2, Acc: 2, Dec: 2 },
      ])
    );

    const result = await getTrainingActualGps({
      weekId: "W4",
      mdTag: "MD-3",
      playerName: "Carl Davordzie",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ambiguous");
    }
  });

  it("propagates Power BI connector errors", async () => {
    executePowerBiDaxQuery.mockResolvedValue({
      ok: false,
      error: {
        code: "auth_failed",
        message: "Failed to obtain Power BI access token.",
      },
    });

    const result = await getTrainingActualGps({
      weekId: "W4",
      mdTag: "MD-3",
      playerName: "Carl Davordzie",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "auth_failed",
        message: "Failed to obtain Power BI access token.",
      },
    });
  });
});

describe("getTrainingActualGpsBatchForDay", () => {
  beforeEach(() => {
    executePowerBiDaxQuery.mockReset();
  });

  it("builds pre-cutoff DAX with Player IN list and Full Training only", () => {
    const dax = buildTrainingActualBatchDax({
      weekId: "W4",
      mdTag: "MD-3",
      playerNames: ["Nacho  Heras", "Raul Cimpean"],
      dateParts: { year: 2026, month: 8, day: 7 },
    });
    expect(dax).toContain('GPS_Log[Player] IN {"Nacho  Heras", "Raul Cimpean"}');
    expect(dax).toContain('GPS_Log[Week ID] = "W4"');
    expect(dax).toContain('GPS_Log[MD_Tag] = "MD-3"');
    expect(dax).toContain('GPS_Log[Drill] = "Full Training"');
    expect(dax).toContain("GPS_Log[Date] = DATE(2026,8,7)");
    expect(dax).toContain('"Player", GPS_Log[Player]');
    expect(dax).toContain('"Drill", GPS_Log[Drill]');
    expect(dax).not.toContain("SUM(");
    expect(dax).not.toContain("MAX(");
  });

  it("returns independent found / not_found / ambiguous in one Execute Queries call", async () => {
    executePowerBiDaxQuery.mockResolvedValue(
      okRows([
        {
          Player: "Player A",
          Drill: "Full Training",
          TD: 100,
          Z5: 10,
          Z6: 1,
          Acc: 2,
          Dec: 3,
        },
        {
          Player: "Player C",
          Drill: "Full Training",
          TD: 200,
          Z5: 1,
          Z6: 1,
          Acc: 1,
          Dec: 1,
        },
        {
          Player: "Player C",
          Drill: "Full Training",
          TD: 210,
          Z5: 2,
          Z6: 2,
          Acc: 2,
          Dec: 2,
        },
      ])
    );

    const result = await getTrainingActualGpsBatchForDay({
      weekId: "W4",
      mdTag: "MD-3",
      date: "2026-08-07",
      playerNames: ["Player A", "Player B", "Player C"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(executePowerBiDaxQuery).toHaveBeenCalledTimes(1);
    expect(result.byPlayerName.get("Player A")?.status).toBe("found");
    expect(result.byPlayerName.get("Player B")).toEqual({ status: "not_found" });
    expect(result.byPlayerName.get("Player C")).toEqual({ status: "ambiguous" });
  });

  it("post-cutoff classifies mixed drills independently and both-drills as ambiguous", async () => {
    executePowerBiDaxQuery.mockResolvedValue(
      okRows([
        {
          Player: "Team",
          Drill: "Full Training",
          TD: 6000,
          Z5: 10,
          Z6: 2,
          Acc: 3,
          Dec: 4,
        },
        {
          Player: "Rehab",
          Drill: "Individual",
          TD: 900,
          Z5: 5,
          Z6: 1,
          Acc: 2,
          Dec: 2,
        },
        {
          Player: "Both",
          Drill: "Full Training",
          TD: 5000,
          Z5: 1,
          Z6: 1,
          Acc: 1,
          Dec: 1,
        },
        {
          Player: "Both",
          Drill: "Individual",
          TD: 800,
          Z5: 1,
          Z6: 1,
          Acc: 1,
          Dec: 1,
        },
      ])
    );

    const result = await getTrainingActualGpsBatchForDay({
      weekId: "W9",
      mdTag: "MD-2",
      date: "2026-09-01",
      playerNames: ["Team", "Rehab", "Both", "Missing"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dax = executePowerBiDaxQuery.mock.calls[0][0] as string;
    expect(dax).toContain('GPS_Log[Drill] IN {"Full Training", "Individual"}');
    expect(result.byPlayerName.get("Team")?.status).toBe("found");
    expect(result.byPlayerName.get("Rehab")?.status).toBe("found");
    expect(result.byPlayerName.get("Both")).toEqual({ status: "ambiguous" });
    expect(result.byPlayerName.get("Missing")).toEqual({ status: "not_found" });
  });

  it("propagates whole-query connector errors without inventing not_found", async () => {
    executePowerBiDaxQuery.mockResolvedValue({
      ok: false,
      error: { code: "timeout", message: "Power BI request timed out." },
    });
    const result = await getTrainingActualGpsBatchForDay({
      weekId: "W4",
      mdTag: "MD-3",
      date: "2026-08-07",
      playerNames: ["Player A"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("timeout");
  });
});

describe("Training Actual isolation", () => {
  it("does not depend on Training_Drill_Switch or Match modules", async () => {
    const src = await readFile(
      path.join(process.cwd(), "lib/powerbi/queries/trainingActual.server.ts"),
      "utf8"
    );
    expect(src).toContain("INDIVIDUAL_TRAINING_START_DATE");
    expect(src).not.toContain("Training_Drill_Switch");
    expect(src).not.toContain("1st Half");
    expect(src).not.toContain("2nd Half");
    expect(src).not.toContain("matchActual");
    expect(src).not.toContain("getMatchBestGps");
    expect(src).not.toContain("Match_Benchmark");
  });

  it("does not change Match Best, Remaining, targets, or Daily Plan modules", async () => {
    const matchBest = await readFile(
      path.join(process.cwd(), "lib/powerbi/queries/matchBest.server.ts"),
      "utf8"
    );
    const remaining = await readFile(
      path.join(process.cwd(), "lib/gpsPlanner/calculations.ts"),
      "utf8"
    );
    const dailyPlan = await readFile(
      path.join(process.cwd(), "lib/gpsPlanner/dailyPlan.server.ts"),
      "utf8"
    );
    expect(matchBest).toContain('MATCH_BEST_METHOD = "single-match best"');
    expect(matchBest).toContain("Match_Benchmark");
    expect(matchBest).not.toContain("INDIVIDUAL_TRAINING");
    expect(matchBest).not.toContain('Drill] IN {"Full Training", "Individual"}');
    expect(remaining).toContain("remainingToAllocate");
    expect(remaining).toContain("Weekly Target % − SUM(Daily Target %)");
    expect(dailyPlan).not.toContain("getTrainingActualGps");
    expect(dailyPlan).not.toContain("INDIVIDUAL_TRAINING");
  });
});
