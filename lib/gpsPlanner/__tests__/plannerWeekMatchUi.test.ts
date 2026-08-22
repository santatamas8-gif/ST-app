import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function readRel(rel: string) {
  return readFile(path.join(process.cwd(), rel), "utf8");
}

describe("Create/Edit Week Match management UI", () => {
  it("Create and Edit Week collect 0–2 Matches with manual date and mdTag", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/WeeklyPlannerView.tsx"
    );
    const fields = await readRel(
      "app/(app)/admin/planner/PlannerWeekMatchesFields.tsx"
    );
    expect(view).toContain("PlannerWeekMatchesFields");
    expect(view).toContain("createPlannerWeekOfficialMatchAction");
    expect(view).toContain("updatePlannerWeekOfficialMatchByIdAction");
    expect(view).toContain("deletePlannerWeekOfficialMatchByIdAction");
    expect(view).toContain("getPlannerWeekOfficialMatchesAction");
    expect(view).toContain("validateWeekMatchDrafts");
    expect(view).toContain("emptyMatchDraft");
    expect(view).not.toContain("planner_week_days");
    expect(fields).toContain("Matches");
    expect(fields).toContain("+ Add Match");
    expect(fields).toContain("+ Add second match");
    expect(fields).toContain("Match {draft.matchOrder}");
    expect(fields).toContain("MD tag");
    expect(fields).toContain('label="Date"');
    expect(fields).not.toContain('mdTag: "MD"');
    expect(fields).not.toContain("MD1");
    expect(fields).not.toContain("M1+1");
    expect(view).not.toContain("Single Match");
    expect(view).not.toContain("Two Match");
  });

  it("does not mix Match rows into Training days storage", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/WeeklyPlannerView.tsx"
    );
    expect(view).toContain("createPlannerWeekDayAction");
    expect(view).toContain("TRAINING_MATCH_DATE_COLLISION_MESSAGE");
    expect(view).not.toContain("day_type");
  });
});

describe("Total Load no longer mutates Match identity", () => {
  it("12–14: Total Load is read-only Match status for 1 and 2 Matches", async () => {
    const view = await readRel(
      "app/(app)/admin/planner/PlannerTotalLoadView.tsx"
    );
    expect(view).toContain("Configured Matches");
    expect(view).toContain("Match {match.matchOrder}");
    expect(view).toContain("formatTotalLoadMatchSourceStatus");
    expect(view).toContain("No configured matches. Add them in Create/Edit Week.");
    expect(view).not.toContain("setPlannerWeekOfficialMatchAction");
    expect(view).not.toContain("deletePlannerWeekOfficialMatchAction");
    expect(view).not.toContain("listPlannerMatchCandidatesAction");
    expect(view).not.toContain("Change match");
    expect(view).not.toContain("Clear match");
    expect(view).not.toContain("Save official match");
    expect(view).not.toContain("selectCandidate");
  });
});
