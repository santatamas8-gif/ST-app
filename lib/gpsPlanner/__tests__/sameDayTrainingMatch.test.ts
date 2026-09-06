import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { validateWeekMatchDrafts } from "@/lib/gpsPlanner/weekMatchForm";

async function readRel(rel: string) {
  return readFile(path.join(process.cwd(), rel), "utf8");
}

describe("same-day Training + Match unlock", () => {
  it("allows one Training date and one Official Match date together", () => {
    expect(
      validateWeekMatchDrafts([
        {
          id: null,
          matchOrder: 1,
          gpsDate: "2026-09-10",
          mdTag: "MD",
          opponent: "",
          matchday: "",
          competition: "",
        },
      ])
    ).toBeNull();
  });

  it("still rejects two Official Matches on the same week/date", () => {
    const error = validateWeekMatchDrafts([
      {
        id: null,
        matchOrder: 1,
        gpsDate: "2026-09-10",
        mdTag: "MD",
        opponent: "",
        matchday: "",
        competition: "",
      },
      {
        id: null,
        matchOrder: 2,
        gpsDate: "2026-09-10",
        mdTag: "MD",
        opponent: "",
        matchday: "",
        competition: "",
      },
    ]);
    expect(error?.code).toBe("official_match_duplicate_date");
  });

  it("keeps two-Match distinct-date behavior", () => {
    expect(
      validateWeekMatchDrafts([
        {
          id: null,
          matchOrder: 1,
          gpsDate: "2026-09-10",
          mdTag: "MD",
          opponent: "",
          matchday: "",
          competition: "",
        },
        {
          id: null,
          matchOrder: 2,
          gpsDate: "2026-09-13",
          mdTag: "MD",
          opponent: "",
          matchday: "",
          competition: "",
        },
      ])
    ).toBeNull();
  });

  it("preserves one Training day per week/date uniqueness", async () => {
    const sql = await readRel("supabase/migrations/039_gps_load_planner.sql");
    expect(sql).toContain("planner_week_days_week_id_date_key");
    expect(sql).toMatch(/UNIQUE \(week_id, date\)/);
    const later = await readRel(
      "supabase/migrations/049_planner_allow_same_day_training_match.sql"
    );
    expect(later).not.toMatch(/DROP CONSTRAINT\s+planner_week_days_week_id_date_key/i);
  });

  it("does not change Training Actual or Individual contract", async () => {
    const classify = await readRel(
      "lib/powerbi/queries/trainingActualClassify.ts"
    );
    const query = await readRel("lib/powerbi/queries/trainingActual.server.ts");
    expect(classify).toContain('INDIVIDUAL_TRAINING_START_DATE = "2026-09-01"');
    expect(classify).toContain('FULL_TRAINING_DRILL = "Full Training"');
    expect(classify).toContain('INDIVIDUAL_TRAINING_DRILL = "Individual"');
    expect(query).toContain(
      'return `GPS_Log[Drill] IN {"${fullTraining}", "${individual}"}`'
    );
    expect(query).not.toContain("SessionType");
    expect(query).not.toContain("planner_week_official_matches");
  });

  it("does not change Match Actual isolation filters", async () => {
    const classify = await readRel(
      "lib/powerbi/queries/matchActualClassify.ts"
    );
    const query = await readRel("lib/powerbi/queries/matchActual.server.ts");
    expect(classify).toContain('MATCH_ACTUAL_MD_TAG = "MD"');
    expect(classify).toContain('MATCH_ACTUAL_SESSION_TYPE = "Team"');
    expect(classify).toContain('"1st Half Extra Time"');
    expect(query).toContain('GPS_Log[SessionType] = "${sessionType}"');
    expect(query).toContain("MATCH_ACTUAL_DRILL_ALLOWLIST");
  });

  it("does not attach Daily Targets or Daily Plan to Match rows", async () => {
    const targets = await readRel("lib/gpsPlanner/dailyTargets.server.ts");
    const dailyPlan = await readRel("lib/gpsPlanner/dailyPlan.server.ts");
    const remaining = await readRel("lib/gpsPlanner/calculations.ts");
    expect(targets).not.toContain("planner_week_official_matches");
    expect(targets).not.toContain("weekMatchForm");
    expect(dailyPlan).not.toContain("planner_week_official_matches");
    expect(remaining).not.toContain("planner_week_official_matches");
  });

  it("keeps Total Load as separate Training + Match queries", async () => {
    const totalLoad = await readRel("lib/gpsPlanner/totalLoad.server.ts");
    expect(totalLoad).toContain("getPlannerWeeklyReviewProgress");
    expect(totalLoad).toContain("getMatchActualGpsBatch");
    expect(totalLoad).not.toContain("trainingDatesCollideWithMatch");
  });
});
