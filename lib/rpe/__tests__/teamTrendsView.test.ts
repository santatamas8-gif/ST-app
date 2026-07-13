import { describe, expect, it } from "vitest";
import { parseTeamTrendsView } from "@/lib/rpe/teamTrendsView";

describe("team trends view parsing", () => {
  it("defaults missing values to load", () => {
    expect(parseTeamTrendsView(null)).toBe("load");
  });

  it.each(["load", "matchday", "weeks"] as const)("preserves valid value %s", (view) => {
    expect(parseTeamTrendsView(view)).toBe(view);
  });

  it("falls back to load for invalid values", () => {
    expect(parseTeamTrendsView("invalid")).toBe("load");
  });
});
