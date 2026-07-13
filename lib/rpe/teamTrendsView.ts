export const TEAM_TRENDS_VIEWS = ["load", "matchday", "weeks"] as const;

export type TeamTrendsView = (typeof TEAM_TRENDS_VIEWS)[number];

const TEAM_TRENDS_VIEW_SET = new Set<string>(TEAM_TRENDS_VIEWS);

export function parseTeamTrendsView(value: string | null): TeamTrendsView {
  if (value != null && TEAM_TRENDS_VIEW_SET.has(value)) {
    return value as TeamTrendsView;
  }
  return "load";
}
