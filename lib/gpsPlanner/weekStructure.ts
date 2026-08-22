/**
 * Combined Week structure — read/display composition only.
 * Training stays on planner_week_days. Match stays on planner_week_official_matches.
 * Do not persist this array. Do not feed it into Daily % / Remaining / write paths.
 */

import { comparePlannerIsoDates } from "@/lib/gpsPlanner/common";

export type CombinedWeekTrainingItem = {
  type: "training";
  date: string;
  mdTag: string;
  trainingDayId: string;
  displayOrder: number;
};

export type CombinedWeekMatchItem = {
  type: "match";
  date: string;
  mdTag: string;
  matchId: string;
  matchOrder: 1 | 2;
};

export type CombinedWeekItem =
  | CombinedWeekTrainingItem
  | CombinedWeekMatchItem;

export function buildCombinedWeekStructure(
  trainingDays: Array<{
    id: string;
    date: string;
    mdTag: string;
    displayOrder: number;
  }>,
  officialMatches: Array<{
    id: string;
    gpsDate: string;
    mdTag: string;
    matchOrder: 1 | 2;
  }>
): CombinedWeekItem[] {
  const items: CombinedWeekItem[] = [
    ...trainingDays.map((day) => ({
      type: "training" as const,
      date: day.date,
      mdTag: day.mdTag,
      trainingDayId: day.id,
      displayOrder: day.displayOrder,
    })),
    ...officialMatches.map((match) => ({
      type: "match" as const,
      date: match.gpsDate,
      mdTag: match.mdTag,
      matchId: match.id,
      matchOrder: match.matchOrder,
    })),
  ];

  return items.sort((a, b) => {
    const byDate = comparePlannerIsoDates(a.date, b.date);
    if (byDate !== 0) return byDate;
    if (a.type !== b.type) return a.type === "training" ? -1 : 1;
    if (a.type === "training" && b.type === "training") {
      return a.displayOrder - b.displayOrder;
    }
    if (a.type === "match" && b.type === "match") {
      return a.matchOrder - b.matchOrder;
    }
    return 0;
  });
}

export function formatCombinedWeekKind(item: CombinedWeekItem): string {
  return item.type === "training" ? "Training" : `Match ${item.matchOrder}`;
}

/** Stored mdTag unchanged. Match adds a display suffix only. */
export function formatCombinedWeekMdDisplay(item: CombinedWeekItem): string {
  if (item.type === "training") return item.mdTag;
  return `${item.mdTag} · Match ${item.matchOrder}`;
}
