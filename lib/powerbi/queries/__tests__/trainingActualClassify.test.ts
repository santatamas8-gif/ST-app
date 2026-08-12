import { describe, expect, it } from "vitest";

import { classifyTrainingActualRowsByPlayer } from "@/lib/powerbi/queries/trainingActualClassify";

describe("classifyTrainingActualRowsByPlayer", () => {
  it("classifies found / not_found / ambiguous independently per player", () => {
    const rows = [
      {
        Player: "Player A",
        TD: 100,
        Z5: 10,
        Z6: 1,
        Acc: 2,
        Dec: 3,
      },
      {
        Player: "Player C",
        TD: 200,
        Z5: 20,
        Z6: 2,
        Acc: 4,
        Dec: 5,
      },
      {
        Player: "Player C",
        TD: 210,
        Z5: 21,
        Z6: 3,
        Acc: 5,
        Dec: 6,
      },
    ];

    const result = classifyTrainingActualRowsByPlayer(
      ["Player A", "Player B", "Player C"],
      rows
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
        { "[Player]": "Player C", "[TD]": 1, Z5: 1, Z6: 1, Acc: 1, Dec: 1 },
        { "[Player]": "Player C", "[TD]": 2, Z5: 2, Z6: 2, Acc: 2, Dec: 2 },
      ]
    );
    expect(result.get("Player C")?.status).toBe("ambiguous");
  });
});
