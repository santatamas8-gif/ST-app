import { describe, expect, it } from "vitest";
import type { DailyPlanPctSummary } from "@/lib/gpsPlanner/types";
import type { TotalLoadPlayerRow } from "@/lib/gpsPlanner/totalLoadAggregation";
import {
  formatCompactDateRange,
  formatCompactIsoDate,
  formatMatchDurationSeconds,
  formatTotalLoadMetricBreakdown,
  formatTotalLoadPercent,
  formatTotalLoadQualityBadge,
  formatWeeklyPlanSharedPct,
  formatWeeklyPlanSummaryLine,
  totalLoadCellPercent,
  totalLoadCellValue,
} from "@/lib/gpsPlanner/totalLoadDisplay";

const ZERO = {
  totalDistance: 0,
  hsr: 0,
  sprint: 0,
  accelerations: 0,
  decelerations: 0,
};

function row(
  overrides: Partial<TotalLoadPlayerRow> & Pick<TotalLoadPlayerRow, "quality">
): TotalLoadPlayerRow {
  return {
    playerId: "p1",
    playerDisplayName: "Raul",
    frozenPowerBiPlayerName: "Raul Cimpean",
    training: {
      completeness: "complete",
      metrics: {
        totalDistance: 6412,
        hsr: 100,
        sprint: 20,
        accelerations: 10,
        decelerations: 8,
      },
      foundDays: 3,
      notFoundDays: 0,
      problematicDays: 0,
    },
    match: {
      quality: "match_ok",
      metrics: {
        totalDistance: 4631,
        hsr: 50,
        sprint: 10,
        accelerations: 5,
        decelerations: 4,
      },
      durationSeconds: 2081,
    },
    total: {
      metrics: {
        totalDistance: 11043,
        hsr: 150,
        sprint: 30,
        accelerations: 15,
        decelerations: 12,
      },
      percentages: {
        totalDistance: 154.48,
        hsr: 20,
        sprint: 10,
        accelerations: 10,
        decelerations: 10,
      },
    },
    ...overrides,
  };
}

describe("formatMatchDurationSeconds", () => {
  it("K: formats total minutes:seconds, not clock HH:MM", () => {
    expect(formatMatchDurationSeconds(5975)).toBe("99:35");
    expect(formatMatchDurationSeconds(5290)).toBe("88:10");
    expect(formatMatchDurationSeconds(2081)).toBe("34:41");
    expect(formatMatchDurationSeconds(0)).toBe("0:00");
    expect(formatMatchDurationSeconds(null)).toBe("—");
    expect(formatMatchDurationSeconds(undefined)).toBe("—");
  });
});

describe("formatTotalLoadPercent / Weekly Plan", () => {
  it("L: same percentage displays as a number", () => {
    expect(formatWeeklyPlanSharedPct(200)).toBe("200%");
    expect(formatTotalLoadPercent(154.48)).toBe("154%");
  });

  it("M: differing Weekly Plan is Mixed, never an average", () => {
    expect(formatWeeklyPlanSharedPct("Mixed")).toBe("Mixed");
    expect(formatWeeklyPlanSharedPct(null)).toBe("—");
    const summary: DailyPlanPctSummary = {
      td: 200,
      hsr: "Mixed",
      sprint: 120,
      acc: 250,
      dec: 225,
    };
    expect(formatWeeklyPlanSummaryLine(summary)).toBe(
      "TD 200% | HSR Mixed | Sprint 120% | Acc 250% | Dec 225%"
    );
  });
});

describe("quality and cell display", () => {
  it("F: Complete row uses numeric Total and %", () => {
    const complete = row({ quality: "complete" });
    expect(formatTotalLoadQualityBadge(complete.quality)).toBe("Complete");
    expect(totalLoadCellValue(complete, "totalDistance")).toBe(11043);
    expect(totalLoadCellPercent(complete, "totalDistance")).toBe(154.48);
  });

  it("G/H: Partial keeps numeric Total and Partial badge", () => {
    const partial = row({
      quality: "partial",
      training: {
        completeness: "partial_not_found",
        metrics: {
          totalDistance: 10500,
          hsr: 100,
          sprint: 20,
          accelerations: 10,
          decelerations: 8,
        },
        foundDays: 2,
        notFoundDays: 1,
        problematicDays: 0,
      },
      total: {
        metrics: {
          totalDistance: 15500,
          hsr: 150,
          sprint: 30,
          accelerations: 15,
          decelerations: 12,
        },
        percentages: {
          totalDistance: 120,
          hsr: 20,
          sprint: 10,
          accelerations: 10,
          decelerations: 10,
        },
      },
    });
    expect(formatTotalLoadQualityBadge(partial.quality)).toBe("Partial");
    expect(totalLoadCellValue(partial, "totalDistance")).toBe(15500);
    expect(formatTotalLoadMetricBreakdown({
      quality: partial.quality,
      trainingValue: 10500,
      matchValue: 5000,
      totalValue: 15500,
      matchQuality: "match_ok",
    })).toContain("Training: 10,500 (Partial)");
  });

  it("I: unsafe Total is null / displayed as —", () => {
    const unsafe = row({
      quality: "unsafe",
      match: {
        quality: "match_ambiguous",
        metrics: null,
        durationSeconds: null,
      },
      total: { metrics: null, percentages: null },
    });
    expect(formatTotalLoadQualityBadge(unsafe.quality)).toBe("Data issue");
    expect(totalLoadCellValue(unsafe, "totalDistance")).toBeNull();
    expect(formatTotalLoadPercent(null)).toBe("—");
    expect(
      formatTotalLoadMetricBreakdown({
        quality: "unsafe",
        trainingValue: 6412,
        matchValue: null,
        totalValue: null,
        matchQuality: "match_ambiguous",
      })
    ).toMatch(/ambiguous/i);
  });

  it("J: match_zero Total comes from composer Total, which includes Training + 0", () => {
    const zero = row({
      quality: "complete",
      match: {
        quality: "match_zero",
        metrics: { ...ZERO },
        durationSeconds: 0,
      },
      total: {
        metrics: {
          totalDistance: 6412,
          hsr: 100,
          sprint: 20,
          accelerations: 10,
          decelerations: 8,
        },
        percentages: {
          totalDistance: 50,
          hsr: 10,
          sprint: 5,
          accelerations: 5,
          decelerations: 5,
        },
      },
    });
    expect(totalLoadCellValue(zero, "totalDistance")).toBe(6412);
    expect(formatMatchDurationSeconds(zero.match.durationSeconds)).toBe("0:00");
    expect(
      formatTotalLoadMetricBreakdown({
        quality: "complete",
        trainingValue: 6412,
        matchValue: 0,
        totalValue: 6412,
        matchQuality: "match_zero",
      })
    ).toBe("Training: 6,412\nMatch: 0\nTotal: 6,412");
  });
});

describe("header date formatting", () => {
  it("formats compact training range and match date", () => {
    expect(formatCompactDateRange("2026-08-11", "2026-08-14")).toBe(
      "11–14 Aug 2026"
    );
    expect(formatCompactIsoDate("2026-08-15")).toBe("15 Aug 2026");
  });
});
