import { describe, expect, it } from "vitest";

import {
  allowsIndividualTrainingDate,
  classifyOnePlayerTrainingActualRows,
  classifyTrainingActualRowsByPlayer,
  INDIVIDUAL_TRAINING_START_DATE,
  sumTrainingActualMetrics,
} from "@/lib/powerbi/queries/trainingActualClassify";

const POST = "2026-09-01";
const PRE = "2026-08-31";

function metricsRow(
  drill: string,
  td: number | null,
  extras?: Partial<{ Z5: number | null; Z6: number | null; Acc: number | null; Dec: number | null }>
) {
  return {
    Drill: drill,
    TD: td,
    Z5: extras && "Z5" in extras ? extras.Z5 ?? null : 1,
    Z6: extras && "Z6" in extras ? extras.Z6 ?? null : 1,
    Acc: extras && "Acc" in extras ? extras.Acc ?? null : 1,
    Dec: extras && "Dec" in extras ? extras.Dec ?? null : 1,
  };
}

describe("allowsIndividualTrainingDate", () => {
  it("is false before the cutoff and true on/after 2026-09-01", () => {
    expect(INDIVIDUAL_TRAINING_START_DATE).toBe("2026-09-01");
    expect(allowsIndividualTrainingDate("2026-08-31")).toBe(false);
    expect(allowsIndividualTrainingDate("2026-09-01")).toBe(true);
    expect(allowsIndividualTrainingDate("2026-09-02")).toBe(true);
    expect(allowsIndividualTrainingDate(undefined)).toBe(false);
    expect(allowsIndividualTrainingDate("")).toBe(false);
    expect(allowsIndividualTrainingDate("not-a-date")).toBe(false);
  });
});

describe("sumTrainingActualMetrics", () => {
  it("adds each metric and keeps null when either side is incomplete", () => {
    expect(
      sumTrainingActualMetrics(
        {
          totalDistance: 5000,
          hsr: 10,
          sprint: 2,
          accelerations: 3,
          decelerations: 4,
        },
        {
          totalDistance: 800,
          hsr: 5,
          sprint: 1,
          accelerations: 2,
          decelerations: 3,
        }
      )
    ).toEqual({
      totalDistance: 5800,
      hsr: 15,
      sprint: 3,
      accelerations: 5,
      decelerations: 7,
    });
    expect(
      sumTrainingActualMetrics(
        {
          totalDistance: 5000,
          hsr: null,
          sprint: 2,
          accelerations: 3,
          decelerations: 4,
        },
        {
          totalDistance: 800,
          hsr: 5,
          sprint: 1,
          accelerations: 2,
          decelerations: 3,
        }
      ).hsr
    ).toBeNull();
  });
});

describe("classifyTrainingActualRowsByPlayer", () => {
  it("classifies found / not_found / ambiguous independently per player", () => {
    const rows = [
      {
        Player: "Player A",
        Drill: "Full Training",
        TD: 100,
        Z5: 10,
        Z6: 1,
        Acc: 2,
        Dec: 3,
      },
      {
        Player: "Player C",
        Drill: "Full Training",
        TD: 200,
        Z5: 20,
        Z6: 2,
        Acc: 4,
        Dec: 5,
      },
      {
        Player: "Player C",
        Drill: "Full Training",
        TD: 210,
        Z5: 21,
        Z6: 3,
        Acc: 5,
        Dec: 6,
      },
    ];

    const result = classifyTrainingActualRowsByPlayer(
      ["Player A", "Player B", "Player C"],
      rows,
      PRE
    );

    expect(result.get("Player A")).toEqual({
      status: "found",
      metrics: {
        totalDistance: 100,
        hsr: 10,
        sprint: 1,
        accelerations: 2,
        decelerations: 3,
      },
    });
    expect(result.get("Player B")).toEqual({ status: "not_found" });
    expect(result.get("Player C")).toEqual({ status: "ambiguous" });
  });

  it("does not aggregate Player C duplicates into one found row", () => {
    const result = classifyTrainingActualRowsByPlayer(
      ["Player C"],
      [
        {
          "[Player]": "Player C",
          "[Drill]": "Full Training",
          "[TD]": 1,
          Z5: 1,
          Z6: 1,
          Acc: 1,
          Dec: 1,
        },
        {
          "[Player]": "Player C",
          "[Drill]": "Full Training",
          "[TD]": 2,
          Z5: 2,
          Z6: 2,
          Acc: 2,
          Dec: 2,
        },
      ],
      POST
    );
    expect(result.get("Player C")?.status).toBe("ambiguous");
  });

  it("excludes Individual before the cutoff even if a row is present", () => {
    const result = classifyOnePlayerTrainingActualRows(
      [metricsRow("Individual", 1200, { Z5: 40, Z6: 5, Acc: 8, Dec: 7 })],
      PRE
    );
    expect(result).toEqual({ status: "not_found" });
  });

  it("finds a single Full Training row before the cutoff", () => {
    const result = classifyOnePlayerTrainingActualRows(
      [metricsRow("Full Training", 5000, { Z5: 10, Z6: 2, Acc: 3, Dec: 4 })],
      PRE
    );
    expect(result).toEqual({
      status: "found",
      metrics: {
        totalDistance: 5000,
        hsr: 10,
        sprint: 2,
        accelerations: 3,
        decelerations: 4,
      },
    });
  });

  it("finds a single Full Training row after the cutoff", () => {
    const result = classifyOnePlayerTrainingActualRows(
      [metricsRow("Full Training", 6000, { Z5: 10, Z6: 2, Acc: 3, Dec: 4 })],
      POST
    );
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.metrics.totalDistance).toBe(6000);
    }
  });

  it("finds a single Individual row from the cutoff", () => {
    const result = classifyTrainingActualRowsByPlayer(
      ["Rehab"],
      [
        {
          Player: "Rehab",
          Drill: "Individual",
          TD: 1200,
          Z5: 40,
          Z6: 5,
          Acc: 8,
          Dec: 7,
        },
      ],
      POST
    );
    expect(result.get("Rehab")).toEqual({
      status: "found",
      metrics: {
        totalDistance: 1200,
        hsr: 40,
        sprint: 5,
        accelerations: 8,
        decelerations: 7,
      },
    });
  });

  it("sums one Full Training and one Individual from the cutoff", () => {
    const result = classifyTrainingActualRowsByPlayer(
      ["Both"],
      [
        {
          Player: "Both",
          Drill: "Full Training",
          TD: 5000,
          Z5: 10,
          Z6: 2,
          Acc: 3,
          Dec: 4,
        },
        {
          Player: "Both",
          Drill: "Individual",
          TD: 800,
          Z5: 5,
          Z6: 1,
          Acc: 2,
          Dec: 3,
        },
      ],
      POST
    );
    expect(result.get("Both")).toEqual({
      status: "found",
      metrics: {
        totalDistance: 5800,
        hsr: 15,
        sprint: 3,
        accelerations: 5,
        decelerations: 7,
      },
    });
  });

  it("is ambiguous when Full Training is duplicated", () => {
    const result = classifyOnePlayerTrainingActualRows(
      [metricsRow("Full Training", 1), metricsRow("Full Training", 2)],
      POST
    );
    expect(result).toEqual({ status: "ambiguous" });
  });

  it("is ambiguous when Individual is duplicated", () => {
    const result = classifyTrainingActualRowsByPlayer(
      ["DupInd"],
      [
        {
          Player: "DupInd",
          Drill: "Individual",
          TD: 1,
          Z5: 1,
          Z6: 1,
          Acc: 1,
          Dec: 1,
        },
        {
          Player: "DupInd",
          Drill: "Individual",
          TD: 2,
          Z5: 2,
          Z6: 2,
          Acc: 2,
          Dec: 2,
        },
      ],
      POST
    );
    expect(result.get("DupInd")).toEqual({ status: "ambiguous" });
  });

  it("is ambiguous for 2 Full Training + 1 Individual", () => {
    const result = classifyOnePlayerTrainingActualRows(
      [
        metricsRow("Full Training", 1),
        metricsRow("Full Training", 2),
        metricsRow("Individual", 3),
      ],
      POST
    );
    expect(result).toEqual({ status: "ambiguous" });
  });

  it("is ambiguous for 1 Full Training + 2 Individual", () => {
    const result = classifyOnePlayerTrainingActualRows(
      [
        metricsRow("Full Training", 1),
        metricsRow("Individual", 2),
        metricsRow("Individual", 3),
      ],
      POST
    );
    expect(result).toEqual({ status: "ambiguous" });
  });

  it("keeps incomplete metrics incomplete instead of inventing a valid sum", () => {
    const result = classifyOnePlayerTrainingActualRows(
      [
        metricsRow("Full Training", 5000, { Z5: null }),
        metricsRow("Individual", 800, { Z5: 5 }),
      ],
      POST
    );
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.metrics.totalDistance).toBe(5800);
      expect(result.metrics.hsr).toBeNull();
    }
  });

  it("classifies different players with different drills independently", () => {
    const result = classifyTrainingActualRowsByPlayer(
      ["Team", "Rehab"],
      [
        {
          Player: "Team",
          Drill: "Full Training",
          TD: 6000,
          Z5: 10,
          Z6: 2,
          Acc: 3,
          Dec: 4,
        },
        {
          Player: "Rehab",
          Drill: "Individual",
          TD: 900,
          Z5: 5,
          Z6: 1,
          Acc: 2,
          Dec: 2,
        },
      ],
      POST
    );
    const team = result.get("Team");
    const rehab = result.get("Rehab");
    expect(team?.status).toBe("found");
    expect(rehab?.status).toBe("found");
    if (team?.status === "found") expect(team.metrics.totalDistance).toBe(6000);
    if (rehab?.status === "found") expect(rehab.metrics.totalDistance).toBe(900);
  });

  it("ignores unsupported drill strings and does not zero-fill", () => {
    const result = classifyTrainingActualRowsByPlayer(
      ["X"],
      [
        {
          Player: "X",
          Drill: "Top Up",
          TD: 1,
          Z5: 1,
          Z6: 1,
          Acc: 1,
          Dec: 1,
        },
        {
          Player: "X",
          Drill: "individual",
          TD: 2,
          Z5: 2,
          Z6: 2,
          Acc: 2,
          Dec: 2,
        },
        {
          Player: "X",
          Drill: "Individual ",
          TD: 3,
          Z5: 3,
          Z6: 3,
          Acc: 3,
          Dec: 3,
        },
        {
          Player: "X",
          Drill: "First Half",
          TD: 4,
          Z5: 4,
          Z6: 4,
          Acc: 4,
          Dec: 4,
        },
        {
          Player: "X",
          Drill: "Second Half",
          TD: 5,
          Z5: 5,
          Z6: 5,
          Acc: 5,
          Dec: 5,
        },
      ],
      POST
    );
    expect(result.get("X")).toEqual({ status: "not_found" });
  });
});
