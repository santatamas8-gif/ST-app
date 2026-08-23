import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

vi.mock("server-only", () => ({}));

const executePowerBiDaxQuery = vi.fn();

vi.mock("@/lib/powerbi/client.server", () => ({
  executePowerBiDaxQuery: (...args: unknown[]) => executePowerBiDaxQuery(...args),
}));

import {
  aggregateMatchCandidates,
  buildMatchCandidateDatesDax,
  getMatchCandidateDates,
  parseCandidateGpsDate,
} from "@/lib/powerbi/queries/matchCandidates.server";

function okRows(rows: Record<string, unknown>[]) {
  return {
    ok: true as const,
    results: [{ tables: [{ rows }] }],
  };
}

describe("buildMatchCandidateDatesDax", () => {
  it("A-E: exact Week ID, MD, Team, allowlisted segments only; no SourceFile identity", () => {
    const dax = buildMatchCandidateDatesDax("W5");
    expect(dax).toContain('GPS_Log[Week ID] = "W5"');
    expect(dax).toContain('GPS_Log[MD_Tag] = "MD"');
    expect(dax).toContain('GPS_Log[SessionType] = "Team"');
    expect(dax).toContain(
      'GPS_Log[Drill] IN {"1st Half", "2nd Half", "1st Half Extra Time", "2nd Half Extra Time"}'
    );
    expect(dax).not.toContain("Full Match");
    expect(dax).not.toContain("90 Min");
    expect(dax).not.toContain("120 Min");
    expect(dax).toContain('"Player", GPS_Log[Player]');
    expect(dax).toContain('"Date", GPS_Log[Date]');
    expect(dax).not.toContain("SourceFile");
    expect(dax).not.toContain("SUM(");
    expect(dax).not.toContain("MAX(");
    expect(dax).not.toContain("MIN(");
    expect(dax).not.toContain("GROUPBY");
    expect(dax).not.toContain("Match_Info");
    expect(dax).not.toContain('"Full Training"');
    expect(dax).not.toContain("TD");
    expect(dax).not.toContain("Duration");
    expect(dax).not.toContain('"First Half"');
    expect(dax).not.toContain('"Second Half"');
    expect(dax).not.toMatch(/GPS_Log\[SessionType\]\s*=\s*"Individual"/);
  });

  it("escapes Week ID quotes", () => {
    const dax = buildMatchCandidateDatesDax('W"5');
    expect(dax).toContain('GPS_Log[Week ID] = "W""5"');
  });
});

describe("aggregateMatchCandidates", () => {
  it("F/G: distinct GPS dates with raw row count and distinct player count", () => {
    const candidates = aggregateMatchCandidates([
      { Date: "2026-08-15T00:00:00", Player: "Raul Cimpean" },
      { Date: "2026-08-15T00:00:00", Player: "Bogdan Otelita" },
      { Date: "2026-08-15T00:00:00", Player: "Raul Cimpean" },
      { Date: "2026-08-08T00:00:00", Player: "Raul Cimpean" },
    ]);
    expect(candidates).toEqual([
      { gpsDate: "2026-08-08", rawRowCount: 1, distinctPlayerCount: 1 },
      { gpsDate: "2026-08-15", rawRowCount: 3, distinctPlayerCount: 2 },
    ]);
  });

  it("D/E: W5-style duplicate half rows collapse to one GPS date", () => {
    const players = Array.from({ length: 15 }, (_, i) => `P${i + 1}`);
    const rows: Record<string, unknown>[] = [];
    for (const player of players.slice(0, 11)) {
      rows.push({ "[Date]": "2026-08-15T00:00:00", "[Player]": player });
    }
    for (const player of players.slice(1, 15)) {
      rows.push({ "[Date]": "2026-08-15T00:00:00", "[Player]": player });
    }
    expect(rows).toHaveLength(25);
    const candidates = aggregateMatchCandidates(rows);
    expect(candidates).toEqual([
      { gpsDate: "2026-08-15", rawRowCount: 25, distinctPlayerCount: 15 },
    ]);
  });

  it("H: empty rows yield empty candidates", () => {
    expect(aggregateMatchCandidates([])).toEqual([]);
  });
});

describe("parseCandidateGpsDate", () => {
  it("C: parses live W5 Execute Queries DateTime string", () => {
    expect(parseCandidateGpsDate("2026-08-15T00:00:00")).toBe("2026-08-15");
  });

  it("parses ISO datetime and Date objects; does not guess invalid values", () => {
    expect(parseCandidateGpsDate("2026-08-15T00:00:00")).toBe("2026-08-15");
    expect(parseCandidateGpsDate(new Date(Date.UTC(2026, 7, 15)))).toBe(
      "2026-08-15"
    );
    expect(parseCandidateGpsDate("not-a-date")).toBeNull();
    expect(parseCandidateGpsDate(45919)).toBeNull();
  });
});

describe("getMatchCandidateDates", () => {
  beforeEach(() => {
    executePowerBiDaxQuery.mockReset();
  });

  it("invalid week id does not call Power BI", async () => {
    const result = await getMatchCandidateDates({ weekId: "  " });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_input");
    expect(executePowerBiDaxQuery).not.toHaveBeenCalled();
  });

  it("H: empty Power BI result is an empty candidate list", async () => {
    executePowerBiDaxQuery.mockResolvedValue(okRows([]));
    const result = await getMatchCandidateDates({ weekId: "W5" });
    expect(result).toEqual({ ok: true, candidates: [] });
  });

  it("I: connector error is returned, not an empty success", async () => {
    executePowerBiDaxQuery.mockResolvedValue({
      ok: false,
      error: { code: "timeout", message: "Power BI request timed out." },
    });
    const result = await getMatchCandidateDates({ weekId: "W5" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("timeout");
  });

  it("returns distinct dates from raw rows", async () => {
    executePowerBiDaxQuery.mockResolvedValue(
      okRows([
        { Date: "2026-08-15T00:00:00", Player: "Raul Cimpean" },
        { Date: "2026-08-15T00:00:00", Player: "Keita Aboubakar" },
      ])
    );
    const result = await getMatchCandidateDates({ weekId: "W5" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidates).toEqual([
      { gpsDate: "2026-08-15", rawRowCount: 2, distinctPlayerCount: 2 },
    ]);
    expect(executePowerBiDaxQuery).toHaveBeenCalledTimes(1);
  });
});

describe("match candidate query has no write path", () => {
  it("J: module is read-only", async () => {
    const src = await readFile(
      path.join(process.cwd(), "lib/powerbi/queries/matchCandidates.server.ts"),
      "utf8"
    );
    expect(src).not.toContain(".insert(");
    expect(src).not.toContain(".update(");
    expect(src).not.toContain(".delete(");
    expect(src).not.toContain("createClient");
    expect(src).not.toContain("planner_week_official_matches");
    expect(src).not.toMatch(/GPS_Log\[SourceFile\]/);
    expect(buildMatchCandidateDatesDax("W5")).not.toContain("SourceFile");
  });
});
