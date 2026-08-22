import { describe, expect, it } from "vitest";

import {
  buildCombinedWeekStructure,
  formatCombinedWeekKind,
  formatCombinedWeekMdDisplay,
} from "@/lib/gpsPlanner/weekStructure";

const T11 = {
  id: "d11",
  date: "2026-08-11",
  mdTag: "MD-4",
  displayOrder: 1,
};
const T12 = {
  id: "d12",
  date: "2026-08-12",
  mdTag: "MD-3",
  displayOrder: 2,
};
const T13 = {
  id: "d13",
  date: "2026-08-13",
  mdTag: "MD-2",
  displayOrder: 3,
};
const T14 = {
  id: "d14",
  date: "2026-08-14",
  mdTag: "MD-1",
  displayOrder: 4,
};
const T18 = {
  id: "d18",
  date: "2026-08-18",
  mdTag: "MD-1",
  displayOrder: 3,
};
const T20 = {
  id: "d20",
  date: "2026-08-20",
  mdTag: "MD+1",
  displayOrder: 1,
};
const T22 = {
  id: "d22",
  date: "2026-08-22",
  mdTag: "MD-1",
  displayOrder: 2,
};

const M1_W5 = {
  id: "m1",
  gpsDate: "2026-08-15",
  mdTag: "MD",
  matchOrder: 1 as const,
};
const M1_19 = {
  id: "m1-19",
  gpsDate: "2026-08-19",
  mdTag: "MD",
  matchOrder: 1 as const,
};
const M2_23 = {
  id: "m2-23",
  gpsDate: "2026-08-23",
  mdTag: "MD",
  matchOrder: 2 as const,
};

describe("buildCombinedWeekStructure", () => {
  it("1: 0 Matches returns Training rows only", () => {
    const items = buildCombinedWeekStructure([T12, T11], []);
    expect(items.map((i) => i.type)).toEqual(["training", "training"]);
    expect(items.map((i) => i.date)).toEqual(["2026-08-11", "2026-08-12"]);
  });

  it("2: 1 Match inserts one Match row", () => {
    const items = buildCombinedWeekStructure([T11, T12, T13, T14], [M1_W5]);
    expect(items.filter((i) => i.type === "match")).toHaveLength(1);
    expect(items.at(-1)).toMatchObject({
      type: "match",
      date: "2026-08-15",
      matchOrder: 1,
      mdTag: "MD",
    });
  });

  it("3: 2 Matches insert both Match rows", () => {
    const items = buildCombinedWeekStructure([T18, T20, T22], [M2_23, M1_19]);
    expect(items.filter((i) => i.type === "match")).toHaveLength(2);
    expect(
      items
        .filter((i) => i.type === "match")
        .map((i) => (i.type === "match" ? i.matchOrder : null))
    ).toEqual([1, 2]);
  });

  it("4: chronological date sort ignores Training display_order", () => {
    const items = buildCombinedWeekStructure([T22, T18, T20], [M2_23, M1_19]);
    expect(items.map((i) => `${i.date}:${formatCombinedWeekKind(i)}`)).toEqual([
      "2026-08-18:Training",
      "2026-08-19:Match 1",
      "2026-08-20:Training",
      "2026-08-22:Training",
      "2026-08-23:Match 2",
    ]);
  });

  it("5: Match outside Training range is still displayed", () => {
    const items = buildCombinedWeekStructure([T11, T12, T13, T14], [M1_W5]);
    expect(items.map((i) => i.date)).toEqual([
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
    ]);
    expect(items.some((i) => i.date === "2026-08-15" && i.type === "match")).toBe(
      true
    );
  });

  it("does not invent MD context tags", () => {
    const items = buildCombinedWeekStructure([T11], [M1_W5]);
    expect(items.map((i) => i.mdTag)).toEqual(["MD-4", "MD"]);
    expect(formatCombinedWeekMdDisplay(items[0])).toBe("MD-4");
    expect(formatCombinedWeekMdDisplay(items[1])).toBe("MD · Match 1");
    expect(formatCombinedWeekKind(items[1])).toBe("Match 1");
    const text = JSON.stringify(items);
    expect(text).not.toContain("M1+1");
    expect(text).not.toContain("M2-3");
    expect(text).not.toContain("M2-2");
    expect(text).not.toContain("M2-1");
  });
});
