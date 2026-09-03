import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

vi.mock("server-only", () => ({}));

const executePowerBiDaxQuery = vi.fn();

vi.mock("@/lib/powerbi/client.server", () => ({
  executePowerBiDaxQuery: (...args: unknown[]) => executePowerBiDaxQuery(...args),
}));

import {
  buildMatchActualBatchDax,
  getMatchActualGpsBatch,
} from "@/lib/powerbi/queries/matchActual.server";
import { buildMatchCandidateDatesDax } from "@/lib/powerbi/queries/matchCandidates.server";

function okRows(rows: Record<string, unknown>[]) {
  return {
    ok: true as const,
    results: [{ tables: [{ rows }] }],
  };
}

describe("buildMatchActualBatchDax", () => {
  it("A/N: exact Team match filters, escaped names, no aggregation", () => {
    const dax = buildMatchActualBatchDax({
      weekId: "W5",
      playerNames: ['O"Brien', "Raul Cimpean"],
      dateParts: { year: 2026, month: 8, day: 15 },
    });

    expect(dax).toContain('GPS_Log[Week ID] = "W5"');
    expect(dax).toContain("GPS_Log[Date] = DATE(2026,8,15)");
    expect(dax).toContain('GPS_Log[MD_Tag] = "MD"');
    expect(dax).toContain('GPS_Log[SessionType] = "Team"');
    expect(dax).toContain(
      'GPS_Log[Drill] IN {"1st Half", "2nd Half", "1st Half Extra Time", "2nd Half Extra Time"}'
    );
    expect(dax).not.toContain("Full Match");
    expect(dax).not.toContain("90 Min");
    expect(dax).not.toContain("120 Min");
    expect(dax).toContain('GPS_Log[Player] IN {"O""Brien", "Raul Cimpean"}');
    expect(dax).toContain('"Player", GPS_Log[Player]');
    expect(dax).toContain('"Drill", GPS_Log[Drill]');
    expect(dax).toContain('"Duration", GPS_Log[Duration]');
    expect(dax).not.toContain("SUM(");
    expect(dax).not.toContain("MAX(");
    expect(dax).not.toContain("MIN(");
    expect(dax).not.toContain("GROUPBY");
    expect(dax).not.toContain("SourceFile");
    expect(dax).not.toContain("Match_Info");
    expect(dax).not.toContain('"Full Training"');
    expect(dax).not.toMatch(/GPS_Log\[SessionType\]\s*=\s*"Individual"/);
    expect(dax).not.toMatch(/GPS_Log\[Drill\]\s*=\s*"Individual"/);
    expect(dax).not.toContain('"First Half"');
    expect(dax).not.toContain('"Second Half"');
  });

  it("candidate and Match Actual DAX use the same four-segment allowlist", () => {
    const actual = buildMatchActualBatchDax({
      weekId: "W5",
      playerNames: ["Doru Andrei"],
      dateParts: { year: 2026, month: 8, day: 15 },
    });
    const candidate = buildMatchCandidateDatesDax("W5");
    const allowlist =
      '{"1st Half", "2nd Half", "1st Half Extra Time", "2nd Half Extra Time"}';
    expect(actual).toContain(`GPS_Log[Drill] IN ${allowlist}`);
    expect(candidate).toContain(`GPS_Log[Drill] IN ${allowlist}`);
  });
});

describe("getMatchActualGpsBatch", () => {
  beforeEach(() => {
    executePowerBiDaxQuery.mockReset();
  });

  it("B: empty player list does not call Power BI", async () => {
    const result = await getMatchActualGpsBatch({
      weekId: "W5",
      gpsDate: "2026-08-15",
      playerNames: [],
    });
    expect(result).toEqual({ ok: true, byPlayerName: new Map() });
    expect(executePowerBiDaxQuery).not.toHaveBeenCalled();
  });

  it("O: connector error is not classified as match_zero", async () => {
    executePowerBiDaxQuery.mockResolvedValue({
      ok: false,
      error: { code: "timeout", message: "Power BI request timed out." },
    });
    const result = await getMatchActualGpsBatch({
      weekId: "W5",
      gpsDate: "2026-08-15",
      playerNames: ["Doru Andrei"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("timeout");
    expect(executePowerBiDaxQuery).toHaveBeenCalledTimes(1);
  });

  it("classifies a mixed batch in one Execute Queries call", async () => {
    executePowerBiDaxQuery.mockResolvedValue(
      okRows([
        {
          Player: "Doru Andrei",
          Drill: "1st Half",
          TD: 5460.59,
          Z5: 256.05,
          Z6: 41.66,
          Acc: 30,
          Dec: 33,
          Duration: "1899-12-30T00:50:52",
        },
        {
          Player: "Doru Andrei",
          Drill: "2nd Half",
          TD: 5582.14,
          Z5: 226.62,
          Z6: 28.12,
          Acc: 32,
          Dec: 29,
          Duration: "1899-12-30T00:48:43",
        },
        {
          Player: "Dup Player",
          Drill: "1st Half",
          TD: 1,
          Z5: 1,
          Z6: 1,
          Acc: 1,
          Dec: 1,
          Duration: "1899-12-30T00:50:52",
        },
        {
          Player: "Dup Player",
          Drill: "1st Half",
          TD: 2,
          Z5: 2,
          Z6: 2,
          Acc: 2,
          Dec: 2,
          Duration: "1899-12-30T00:50:52",
        },
      ])
    );

    const result = await getMatchActualGpsBatch({
      weekId: "W5",
      gpsDate: "2026-08-15",
      playerNames: ["Doru Andrei", "Dup Player", "Ghost Player"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(executePowerBiDaxQuery).toHaveBeenCalledTimes(1);
    expect(result.byPlayerName.get("Doru Andrei")?.quality).toBe("match_ok");
    expect(result.byPlayerName.get("Doru Andrei")?.metrics?.durationSeconds).toBe(
      5975
    );
    expect(result.byPlayerName.get("Dup Player")?.quality).toBe("match_ambiguous");
    expect(result.byPlayerName.get("Ghost Player")?.quality).toBe("match_zero");
  });
});

describe("Training Actual isolation", () => {
  it("Q: Training Actual is not the Match path; Match DAX still excludes Individual", async () => {
    const src = await readFile(
      path.join(process.cwd(), "lib/powerbi/queries/trainingActual.server.ts"),
      "utf8"
    );
    const match = await readFile(
      path.join(process.cwd(), "lib/powerbi/queries/matchActual.server.ts"),
      "utf8"
    );
    expect(src).toContain("FULL_TRAINING_DRILL");
    expect(src).toContain("INDIVIDUAL_TRAINING_START_DATE");
    expect(src).toContain('GPS_Log[Drill] IN {"${fullTraining}", "${individual}"}');
    expect(src).not.toContain("1st Half");
    expect(src).not.toContain("2nd Half");
    expect(src).not.toContain("matchActual");
    expect(match).toContain(
      'GPS_Log[Drill] IN {${drillList}}'
    );
    expect(match).not.toContain("INDIVIDUAL_TRAINING");
    expect(match).not.toContain('"Full Training"');
    expect(match).not.toContain('"Individual"');
  });
});
