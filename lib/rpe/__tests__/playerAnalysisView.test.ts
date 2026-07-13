import { describe, expect, it } from "vitest";
import { parsePlayerAnalysisView } from "@/lib/rpe/playerAnalysisView";

describe("player analysis view parsing", () => {
  it("defaults missing values to compare", () => {
    expect(parsePlayerAnalysisView(null)).toBe("compare");
  });

  it.each(["compare", "self", "team", "history"] as const)("preserves valid value %s", (view) => {
    expect(parsePlayerAnalysisView(view)).toBe(view);
  });

  it("falls back to compare for invalid values", () => {
    expect(parsePlayerAnalysisView("invalid")).toBe("compare");
  });
});
