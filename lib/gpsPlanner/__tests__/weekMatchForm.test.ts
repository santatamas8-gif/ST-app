import { describe, expect, it } from "vitest";

import type { PlannerWeekOfficialMatch } from "@/lib/gpsPlanner/types";
import {
  buildWeekMatchPersistPlan,
  canRemoveConfiguredMatch,
  draftFromStoredMatch,
  emptyMatchDraft,
  optionalMatchText,
  REMOVE_MATCH_1_BLOCKED_MESSAGE,
  TRAINING_MATCH_DATE_COLLISION_MESSAGE,
  validateWeekMatchDrafts,
  type WeekMatchDraft,
} from "@/lib/gpsPlanner/weekMatchForm";

const MATCH_1: PlannerWeekOfficialMatch = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  weekId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  gpsDate: "2026-08-15",
  matchOrder: 1,
  mdTag: "MD",
  opponent: "FK Csikszereda",
  matchday: "Matchday 5",
  competition: "Liga 1",
  createdBy: null,
  updatedBy: null,
  createdAt: "",
  updatedAt: "",
};

function draft(
  order: 1 | 2,
  overrides: Partial<WeekMatchDraft> = {}
): WeekMatchDraft {
  return {
    ...emptyMatchDraft(order),
    gpsDate: order === 1 ? "2026-08-19" : "2026-08-23",
    mdTag: "MD",
    ...overrides,
  };
}

describe("validateWeekMatchDrafts", () => {
  it("1: 0 Matches is valid", () => {
    expect(validateWeekMatchDrafts([], [])).toBeNull();
    expect(validateWeekMatchDrafts([], ["2026-08-18"])).toBeNull();
  });

  it("2: 1 Match with date + mdTag is valid", () => {
    expect(validateWeekMatchDrafts([draft(1)], [])).toBeNull();
  });

  it("3: 2 Matches with distinct dates and identical MD tags are valid", () => {
    expect(
      validateWeekMatchDrafts([draft(1), draft(2, { mdTag: "MD" })], [
        "2026-08-18",
        "2026-08-20",
        "2026-08-22",
      ])
    ).toBeNull();
  });

  it("4: duplicate Match dates are rejected", () => {
    const error = validateWeekMatchDrafts(
      [draft(1, { gpsDate: "2026-08-19" }), draft(2, { gpsDate: "2026-08-19" })],
      []
    );
    expect(error?.code).toBe("official_match_duplicate_date");
  });

  it("5: Training/Match same-date is rejected before DB write", () => {
    const error = validateWeekMatchDrafts(
      [draft(1, { gpsDate: "2026-08-20" })],
      ["2026-08-18", "2026-08-20"]
    );
    expect(error?.code).toBe("invalid_input");
    expect(error?.message).toBe(TRAINING_MATCH_DATE_COLLISION_MESSAGE);
  });

  it("6: blank mdTag is rejected", () => {
    const error = validateWeekMatchDrafts([draft(1, { mdTag: "   " })], []);
    expect(error?.code).toBe("invalid_md_tag");
  });

  it("blank Match date is rejected", () => {
    const error = validateWeekMatchDrafts([draft(1, { gpsDate: "" })], []);
    expect(error?.code).toBe("invalid_date");
  });
});

describe("edit / add / delete Match drafts", () => {
  it("7: Edit existing Match preserves row ID", () => {
    const loaded = draftFromStoredMatch(MATCH_1);
    expect(loaded.id).toBe(MATCH_1.id);
    const edited = { ...loaded, gpsDate: "2026-08-16", mdTag: "MD" };
    const plan = buildWeekMatchPersistPlan([edited]);
    expect(plan.update).toHaveLength(1);
    expect(plan.update[0].id).toBe(MATCH_1.id);
    expect(plan.create).toHaveLength(0);
  });

  it("8: Add Match 2 leaves Match 1 as update-only", () => {
    const match1 = draftFromStoredMatch(MATCH_1);
    const match2 = emptyMatchDraft(2);
    match2.gpsDate = "2026-08-18";
    match2.mdTag = "MD";
    const plan = buildWeekMatchPersistPlan([match1, match2]);
    expect(plan.update).toEqual([match1]);
    expect(plan.create).toEqual([match2]);
    expect(plan.update[0].id).toBe(MATCH_1.id);
    expect(plan.create[0].id).toBeNull();
    expect(plan.create[0].matchOrder).toBe(2);
  });

  it("9/10: Match 1 removal is blocked while Match 2 exists; Match 2 may be removed", () => {
    const drafts = [draft(1, { id: MATCH_1.id }), draft(2, { id: "c".repeat(36) })];
    expect(canRemoveConfiguredMatch(drafts, 1)).toBe(false);
    expect(canRemoveConfiguredMatch(drafts, 2)).toBe(true);
    expect(REMOVE_MATCH_1_BLOCKED_MESSAGE).toBe("Remove Match 2 first.");
  });

  it("11: deleting the sole Match 1 leaves 0 Matches valid", () => {
    expect(canRemoveConfiguredMatch([draft(1, { id: MATCH_1.id })], 1)).toBe(
      true
    );
    expect(validateWeekMatchDrafts([], ["2026-08-11"])).toBeNull();
  });
});

describe("optional metadata and empty drafts", () => {
  it("empty optional fields become null, not placeholders", () => {
    expect(optionalMatchText("")).toBeNull();
    expect(optionalMatchText("  ")).toBeNull();
    expect(optionalMatchText(" Liga 1 ")).toBe("Liga 1");
  });

  it("new Match draft does not prefill MD", () => {
    expect(emptyMatchDraft(1).mdTag).toBe("");
    expect(emptyMatchDraft(2).mdTag).toBe("");
  });
});
