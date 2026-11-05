import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

function loadEnv() {
  const file = ".env.local";
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    if (process.env[key]) continue;
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const live = process.env.DRILL_ANALYSIS_LIVE === "1";
if (live) loadEnv();

import { buildDrillAnalysisModel } from "@/lib/drillAnalysis/assemble";
import { buildOccurrences, parseDrillSourceRow } from "@/lib/drillAnalysis/metrics";
import { buildDrillSessionRowsDax } from "@/lib/drillAnalysis/query";
import type { SessionRef } from "@/lib/drillAnalysis/types";
import { executePowerBiDaxQuery } from "@/lib/powerbi/client.server";
import { firstResultRows } from "@/lib/powerbi/queries/rowUtils";

const session: SessionRef = {
  date: "2026-10-21",
  weekId: "W15",
  mdTag: "MD-5",
  sessionType: "Team",
};

function displayNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = /(-?\d+)\s*m?$/.exec(value.trim());
  return match ? Number(match[1]) : null;
}

async function measure(name: string, drill: string, date = "2026,10,21"): Promise<unknown> {
  const query = `EVALUATE ROW("v", CALCULATE([${name}], GPS_Log[Date] = DATE(${date}), GPS_Log[Drill] = "${drill}", GPS_Log[SessionType] = "Team", GPS_Log[MD_Tag] = "MD-5"))`;
  const result = await executePowerBiDaxQuery(query);
  if (!result.ok) throw new Error(result.error.message);
  const row = firstResultRows(result.results)[0] ?? {};
  return Object.values(row)[0];
}

describe.skipIf(!live)("live Power BI drill display", () => {

  it("matches the 2026-10-21 display measures for 6v6 SET1 and Full Training", async () => {
    const dax = buildDrillSessionRowsDax(session);
    expect(dax).toBeTruthy();
    const rows = await executePowerBiDaxQuery(dax!);
    expect(rows.ok).toBe(true);
    if (!rows.ok) return;
    const built = buildOccurrences(session, firstResultRows(rows.results).map((row) => parseDrillSourceRow(row)));
    const view = buildDrillAnalysisModel({
      session,
      occurrences: built.occurrences,
      savedCards: [],
      player: null,
      excludedBlankDrillRows: built.excludedBlankDrillRows,
      excludedBlankPlayerRows: built.excludedBlankPlayerRows,
    });
    const set1 = view.cards.find((card) => card.displayName === "6v6 - 30x40m - SET1");
    expect(set1).toBeTruthy();
    const values = set1!.columns[0]!.metrics;
    expect(values.totalDistance).toBe(displayNumber(await measure("Total Distance Display", "6v6 - 30x40m - SET1")));
    expect(values.tempoDistance).toBe(displayNumber(await measure("Tempo Distance Display", "6v6 - 30x40m - SET1")));
    expect(values.hsr).toBe(displayNumber(await measure("HSR Display", "6v6 - 30x40m - SET1")));
    expect(values.sprintDistance).toBe(displayNumber(await measure("Sprint Distance Display", "6v6 - 30x40m - SET1")));
    expect(values.accelerations).toBe(displayNumber(await measure("Accelerations Display", "6v6 - 30x40m - SET1")));
    expect(values.decelerations).toBe(displayNumber(await measure("Decelerations Display", "6v6 - 30x40m - SET1")));
    expect(values.distancePerMin).toBe(displayNumber(await measure("Distance Per Minute Display", "6v6 - 30x40m - SET1")));

    expect(view.fullTraining.status).toBe("ready");
    const full = view.fullTraining.columns[0]!.metrics;
    expect(full.sprintDistance).toBe(displayNumber(await measure("Sprint Distance Display", "Full Training")));
    expect(full.distancePerMin).toBe(displayNumber(await measure("Distance Per Minute Display", "Full Training")));
    expect(full.totalDistance).toBe(displayNumber(await measure("Total Distance Display", "Full Training")));
    expect(full.hsr).toBe(displayNumber(await measure("HSR Display", "Full Training")));

    const playerCheck = await executePowerBiDaxQuery(`EVALUATE
CALCULATETABLE(
  ROW(
    "players", COUNTROWS(VALUES(GPS_Log[Player])),
    "td", COUNTROWS(FILTER(VALUES(GPS_Log[Player]), ROUND(CALCULATE(MAX(GPS_Log[TD])), 0) = ROUND(CALCULATE([AVG Total Distance]), 0))),
    "tempo", COUNTROWS(FILTER(VALUES(GPS_Log[Player]), ROUND(CALCULATE(MAX(GPS_Log[Z4])), 0) = ROUND(CALCULATE([AVG Tempo Distance]), 0))),
    "hsr", COUNTROWS(FILTER(VALUES(GPS_Log[Player]), ROUND(CALCULATE(MAX(GPS_Log[Z5])), 0) = ROUND(CALCULATE([HSR]), 0))),
    "sprint", COUNTROWS(FILTER(VALUES(GPS_Log[Player]), ROUND(CALCULATE(MAX(GPS_Log[Z6])), 0) = ROUND(CALCULATE([AVG Sprint Distance]), 0))),
    "acc", COUNTROWS(FILTER(VALUES(GPS_Log[Player]), ROUND(CALCULATE(MAX(GPS_Log[Acc])), 0) = ROUND(CALCULATE([AVG Accelerations]), 0))),
    "dec", COUNTROWS(FILTER(VALUES(GPS_Log[Player]), ROUND(CALCULATE(MAX(GPS_Log[Dec])), 0) = ROUND(CALCULATE([AVG Decelerations]), 0))),
    "dpm", COUNTROWS(FILTER(VALUES(GPS_Log[Player]), ROUND(CALCULATE(MAX(GPS_Log[Distance Per Min])), 0) = ROUND(CALCULATE([Distance/Min]), 0)))
  ),
  GPS_Log[Date] = DATE(2026,10,21),
  GPS_Log[Drill] = "6v6 - 30x40m - SET1",
  GPS_Log[SessionType] = "Team",
  GPS_Log[MD_Tag] = "MD-5"
)`);
    expect(playerCheck.ok).toBe(true);
    if (!playerCheck.ok) return;
    const counts = firstResultRows(playerCheck.results)[0] ?? {};
    const players = Number(Object.values(counts)[0]);
    for (const value of Object.values(counts)) {
      expect(Number(value)).toBe(players);
    }
    expect(players).toBeGreaterThan(1);
  }, 120_000);
});
