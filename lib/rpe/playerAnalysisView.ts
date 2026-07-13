export const PLAYER_ANALYSIS_VIEWS = ["compare", "self", "team", "history"] as const;

export type PlayerAnalysisView = (typeof PLAYER_ANALYSIS_VIEWS)[number];

const PLAYER_ANALYSIS_VIEW_SET = new Set<string>(PLAYER_ANALYSIS_VIEWS);

export function parsePlayerAnalysisView(value: string | null): PlayerAnalysisView {
  if (value != null && PLAYER_ANALYSIS_VIEW_SET.has(value)) {
    return value as PlayerAnalysisView;
  }
  return "compare";
}
