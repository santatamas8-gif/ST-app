/**
 * Create/Edit Week Match draft validation.
 * Client-safe. No I/O. Does not write planner_week_days.
 */

import {
  isPlannerIsoDate,
  plannerErr,
  type PlannerSafeError,
} from "@/lib/gpsPlanner/common";
import type { PlannerWeekOfficialMatch } from "@/lib/gpsPlanner/types";

export const TRAINING_MATCH_DATE_COLLISION_MESSAGE =
  "A Training day and a Match cannot share the same date.";

export const REMOVE_MATCH_1_BLOCKED_MESSAGE = "Remove Match 2 first.";

export type WeekMatchDraft = {
  id: string | null;
  matchOrder: 1 | 2;
  gpsDate: string;
  mdTag: string;
  opponent: string;
  matchday: string;
  competition: string;
};

export function emptyMatchDraft(matchOrder: 1 | 2): WeekMatchDraft {
  return {
    id: null,
    matchOrder,
    gpsDate: "",
    mdTag: "",
    opponent: "",
    matchday: "",
    competition: "",
  };
}

export function draftFromStoredMatch(
  match: PlannerWeekOfficialMatch
): WeekMatchDraft {
  return {
    id: match.id,
    matchOrder: match.matchOrder,
    gpsDate: match.gpsDate,
    mdTag: match.mdTag,
    opponent: match.opponent ?? "",
    matchday: match.matchday ?? "",
    competition: match.competition ?? "",
  };
}

export function optionalMatchText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function trainingDatesCollideWithMatch(
  matchDate: string,
  trainingDates: string[]
): boolean {
  return trainingDates.includes(matchDate);
}

export function canRemoveConfiguredMatch(
  drafts: Array<{ matchOrder: 1 | 2 }>,
  removingOrder: 1 | 2
): boolean {
  if (removingOrder === 1 && drafts.some((draft) => draft.matchOrder === 2)) {
    return false;
  }
  return true;
}

export function validateWeekMatchDrafts(
  drafts: WeekMatchDraft[],
  trainingDates: string[]
): PlannerSafeError | null {
  if (drafts.length > 2) {
    return plannerErr("invalid_input", "A planner week can have at most two matches.");
  }

  const orders = drafts.map((draft) => draft.matchOrder);
  if (orders.some((order) => order !== 1 && order !== 2)) {
    return plannerErr("invalid_input", "matchOrder must be 1 or 2.");
  }
  if (new Set(orders).size !== orders.length) {
    return plannerErr(
      "official_match_duplicate_order",
      "A match with this order already exists for this planner week."
    );
  }
  if (drafts.length === 1 && drafts[0].matchOrder !== 1) {
    return plannerErr("invalid_input", "The first configured match must be Match 1.");
  }
  if (
    drafts.length === 2 &&
    !(drafts.some((d) => d.matchOrder === 1) && drafts.some((d) => d.matchOrder === 2))
  ) {
    return plannerErr("invalid_input", "Two matches must be Match 1 and Match 2.");
  }

  const dates: string[] = [];
  for (const draft of drafts) {
    const gpsDate = draft.gpsDate.trim();
    if (!isPlannerIsoDate(gpsDate)) {
      return plannerErr("invalid_date", "Match date is required.");
    }
    const mdTag = draft.mdTag.trim();
    if (!mdTag) {
      return plannerErr("invalid_md_tag", "MD tag is required.");
    }
    if (dates.includes(gpsDate)) {
      return plannerErr(
        "official_match_duplicate_date",
        "Match 1 and Match 2 cannot use the same date."
      );
    }
    dates.push(gpsDate);
    if (trainingDatesCollideWithMatch(gpsDate, trainingDates)) {
      return plannerErr("invalid_input", TRAINING_MATCH_DATE_COLLISION_MESSAGE);
    }
  }

  return null;
}

export type WeekMatchPersistPlan = {
  create: WeekMatchDraft[];
  update: WeekMatchDraft[];
};

export function buildWeekMatchPersistPlan(
  drafts: WeekMatchDraft[]
): WeekMatchPersistPlan {
  return {
    create: drafts.filter((draft) => draft.id == null),
    update: drafts.filter((draft) => draft.id != null),
  };
}
