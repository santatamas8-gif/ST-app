import { describe, expect, it } from "vitest";

import {
  MATCH_ACTUAL_FIRST_EXTRA_TIME,
  MATCH_ACTUAL_FIRST_HALF,
  MATCH_ACTUAL_SECOND_EXTRA_TIME,
  MATCH_ACTUAL_SECOND_HALF,
  classifyMatchActualRowsByPlayer,
  parseGpsLogDurationToSeconds,
  type MatchActualDrill,
} from "@/lib/powerbi/queries/matchActualClassify";

function halfRow(
  player: string,
  drill: MatchActualDrill,
  metrics: {
    td: number;
    z5: number;
    z6: number;
    acc: number;
    dec: number;
    duration: unknown;
  }
): Record<string, unknown> {
  return {
    Player: player,
    Drill: drill,
    TD: metrics.td,
    Z5: metrics.z5,
    Z6: metrics.z6,
    Acc: metrics.acc,
    Dec: metrics.dec,
    Duration: metrics.duration,
  };
}

const DORU_1ST = {
  td: 5460.59,
  z5: 256.05,
  z6: 41.66,
  acc: 30,
  dec: 33,
  duration: "1899-12-30T00:50:52",
};
const DORU_2ND = {
  td: 5582.14,
  z5: 226.62,
  z6: 28.12,
  acc: 32,
  dec: 29,
  duration: "1899-12-30T00:48:43",
};

describe("parseGpsLogDurationToSeconds", () => {
  it("parses live ISO DateTime duration (Excel epoch clock time)", () => {
    expect(parseGpsLogDurationToSeconds("1899-12-30T00:50:52")).toBe(3052);
    expect(parseGpsLogDurationToSeconds("1899-12-30T00:48:43")).toBe(2923);
    expect(parseGpsLogDurationToSeconds("1899-12-30T00:37:18")).toBe(2238);
    expect(parseGpsLogDurationToSeconds("1899-12-30T00:34:41")).toBe(2081);
    expect(parseGpsLogDurationToSeconds("1899-12-30T00:50:52.000Z")).toBe(3052);
  });

  it("parses Excel day-fraction numbers", () => {
    expect(parseGpsLogDurationToSeconds(3052 / 86400)).toBeCloseTo(3052, 6);
  });

  it("rejects invalid Duration instead of coercing to 0", () => {
    expect(parseGpsLogDurationToSeconds("not-a-duration")).toBeNull();
    expect(parseGpsLogDurationToSeconds("")).toBeNull();
    expect(parseGpsLogDurationToSeconds(null)).toBeNull();
    expect(parseGpsLogDurationToSeconds(-1)).toBeNull();
    expect(parseGpsLogDurationToSeconds(3052)).toBeNull();
  });
});

describe("classifyMatchActualRowsByPlayer", () => {
  it("C: both halves valid — Doru reference, unrounded metrics + duration sum", () => {
    const result = classifyMatchActualRowsByPlayer(
      ["Doru Andrei"],
      [
        halfRow("Doru Andrei", MATCH_ACTUAL_FIRST_HALF, DORU_1ST),
        halfRow("Doru Andrei", MATCH_ACTUAL_SECOND_HALF, DORU_2ND),
      ]
    );
    expect(result.get("Doru Andrei")).toEqual({
      playerName: "Doru Andrei",
      quality: "match_ok",
      halves: {
        first: "valid",
        second: "valid",
        firstExtraTime: "absent",
        secondExtraTime: "absent",
      },
      metrics: {
        totalDistance: 11042.73,
        hsr: 482.67,
        sprint: 69.78,
        accelerations: 62,
        decelerations: 62,
        durationSeconds: 5975,
      },
    });
  });

  it("P: Fabio live TD regression (4875.53 not 4875.30)", () => {
    const result = classifyMatchActualRowsByPlayer(
      ["Fabio Vianna"],
      [
        halfRow("Fabio Vianna", MATCH_ACTUAL_FIRST_HALF, {
          td: 4875.53,
          z5: 250,
          z6: 50,
          acc: 30,
          dec: 31,
          duration: "1899-12-30T00:50:52",
        }),
        halfRow("Fabio Vianna", MATCH_ACTUAL_SECOND_HALF, {
          td: 4102.75,
          z5: 255.34,
          z6: 47.97,
          acc: 36,
          dec: 36,
          duration: "1899-12-30T00:37:18",
        }),
      ]
    );
    const row = result.get("Fabio Vianna");
    expect(row?.quality).toBe("match_ok");
    expect(row?.metrics?.totalDistance).toBeCloseTo(8978.28, 10);
    expect(row?.metrics?.hsr).toBeCloseTo(505.34, 10);
    expect(row?.metrics?.sprint).toBeCloseTo(97.97, 10);
    expect(row?.metrics?.accelerations).toBe(66);
    expect(row?.metrics?.decelerations).toBe(67);
    expect(row?.metrics?.durationSeconds).toBe(5290);
  });

  it("D: first half only → match_ok", () => {
    const result = classifyMatchActualRowsByPlayer(
      ["Only First"],
      [halfRow("Only First", MATCH_ACTUAL_FIRST_HALF, DORU_1ST)]
    );
    expect(result.get("Only First")).toMatchObject({
      quality: "match_ok",
      halves: {
        first: "valid",
        second: "absent",
        firstExtraTime: "absent",
        secondExtraTime: "absent",
      },
      metrics: {
        totalDistance: 5460.59,
        hsr: 256.05,
        sprint: 41.66,
        accelerations: 30,
        decelerations: 33,
        durationSeconds: 3052,
      },
    });
  });

  it("E: second half only (Raul) → match_ok", () => {
    const result = classifyMatchActualRowsByPlayer(
      ["Raul Cimpean"],
      [
        halfRow("Raul Cimpean", MATCH_ACTUAL_SECOND_HALF, {
          td: 4517.5,
          z5: 239.49,
          z6: 47.41,
          acc: 26,
          dec: 28,
          duration: "1899-12-30T00:34:41",
        }),
      ]
    );
    expect(result.get("Raul Cimpean")).toEqual({
      playerName: "Raul Cimpean",
      quality: "match_ok",
      halves: {
        first: "absent",
        second: "valid",
        firstExtraTime: "absent",
        secondExtraTime: "absent",
      },
      metrics: {
        totalDistance: 4517.5,
        hsr: 239.49,
        sprint: 47.41,
        accelerations: 26,
        decelerations: 28,
        durationSeconds: 2081,
      },
    });
  });

  it("F: both absent → match_zero with numeric zeros", () => {
    const result = classifyMatchActualRowsByPlayer(["Ghost Player"], []);
    expect(result.get("Ghost Player")).toEqual({
      playerName: "Ghost Player",
      quality: "match_zero",
      halves: {
        first: "absent",
        second: "absent",
        firstExtraTime: "absent",
        secondExtraTime: "absent",
      },
      metrics: {
        totalDistance: 0,
        hsr: 0,
        sprint: 0,
        accelerations: 0,
        decelerations: 0,
        durationSeconds: 0,
      },
    });
  });

  it("G: duplicate first half → match_ambiguous, no Match Actual", () => {
    const result = classifyMatchActualRowsByPlayer(
      ["Dup First"],
      [
        halfRow("Dup First", MATCH_ACTUAL_FIRST_HALF, DORU_1ST),
        halfRow("Dup First", MATCH_ACTUAL_FIRST_HALF, DORU_1ST),
        halfRow("Dup First", MATCH_ACTUAL_SECOND_HALF, DORU_2ND),
      ]
    );
    expect(result.get("Dup First")).toEqual({
      playerName: "Dup First",
      quality: "match_ambiguous",
      halves: {
        first: "ambiguous",
        second: "valid",
        firstExtraTime: "absent",
        secondExtraTime: "absent",
      },
      metrics: null,
    });
  });

  it("H: duplicate second half → match_ambiguous, no fallback to the valid first", () => {
    const result = classifyMatchActualRowsByPlayer(
      ["Dup Second"],
      [
        halfRow("Dup Second", MATCH_ACTUAL_FIRST_HALF, DORU_1ST),
        halfRow("Dup Second", MATCH_ACTUAL_SECOND_HALF, DORU_2ND),
        halfRow("Dup Second", MATCH_ACTUAL_SECOND_HALF, DORU_2ND),
      ]
    );
    expect(result.get("Dup Second")).toEqual({
      playerName: "Dup Second",
      quality: "match_ambiguous",
      halves: {
        first: "valid",
        second: "ambiguous",
        firstExtraTime: "absent",
        secondExtraTime: "absent",
      },
      metrics: null,
    });
  });

  it("I: one player's duplicate does not corrupt other players", () => {
    const result = classifyMatchActualRowsByPlayer(
      ["Safe Player", "Dup Player", "Zero Player"],
      [
        halfRow("Safe Player", MATCH_ACTUAL_SECOND_HALF, DORU_2ND),
        halfRow("Dup Player", MATCH_ACTUAL_FIRST_HALF, DORU_1ST),
        halfRow("Dup Player", MATCH_ACTUAL_FIRST_HALF, DORU_1ST),
      ]
    );
    expect(result.get("Safe Player")?.quality).toBe("match_ok");
    expect(result.get("Dup Player")?.quality).toBe("match_ambiguous");
    expect(result.get("Dup Player")?.metrics).toBeNull();
    expect(result.get("Zero Player")?.quality).toBe("match_zero");
  });

  it("K: invalid Duration on a present half → data_issue, not zero", () => {
    const result = classifyMatchActualRowsByPlayer(
      ["Bad Duration"],
      [
        halfRow("Bad Duration", MATCH_ACTUAL_FIRST_HALF, {
          ...DORU_1ST,
          duration: "unparseable",
        }),
      ]
    );
    expect(result.get("Bad Duration")).toEqual({
      playerName: "Bad Duration",
      quality: "data_issue",
      halves: {
        first: "valid",
        second: "absent",
        firstExtraTime: "absent",
        secondExtraTime: "absent",
      },
      metrics: null,
    });
  });

  it("K: malformed numeric TD on a present half → data_issue, not zero", () => {
    const result = classifyMatchActualRowsByPlayer(
      ["Bad TD"],
      [
        {
          Player: "Bad TD",
          Drill: MATCH_ACTUAL_FIRST_HALF,
          TD: "not-a-number",
          Z5: 1,
          Z6: 1,
          Acc: 1,
          Dec: 1,
          Duration: "1899-12-30T00:50:52",
        },
      ]
    );
    expect(result.get("Bad TD")).toEqual({
      playerName: "Bad TD",
      quality: "data_issue",
      halves: {
        first: "valid",
        second: "absent",
        firstExtraTime: "absent",
        secondExtraTime: "absent",
      },
      metrics: null,
    });
  });

  it("L/M: preserves raw decimals and Acc/Dec sums", () => {
    const result = classifyMatchActualRowsByPlayer(
      ["Moses Mawa"],
      [
        halfRow("Moses Mawa", MATCH_ACTUAL_FIRST_HALF, {
          td: 4600.41,
          z5: 200.1,
          z6: 100.12,
          acc: 40,
          dec: 30,
          duration: "1899-12-30T00:50:52",
        }),
        halfRow("Moses Mawa", MATCH_ACTUAL_SECOND_HALF, {
          td: 4624.5,
          z5: 288.09,
          z6: 123.12,
          acc: 45,
          dec: 36,
          duration: "1899-12-30T00:48:43",
        }),
      ]
    );
    const metrics = result.get("Moses Mawa")?.metrics;
    expect(metrics?.totalDistance).toBeCloseTo(9224.91, 10);
    expect(metrics?.hsr).toBeCloseTo(488.19, 10);
    expect(metrics?.sprint).toBeCloseTo(223.24, 10);
    expect(metrics?.accelerations).toBe(85);
    expect(metrics?.decelerations).toBe(66);
    expect(metrics?.durationSeconds).toBe(5975);
  });

  it("does not treat Full Training / First Half substitute drills as match halves", () => {
    const result = classifyMatchActualRowsByPlayer(
      ["Wrong Drill"],
      [
        {
          Player: "Wrong Drill",
          Drill: "Full Training",
          TD: 9000,
          Z5: 1,
          Z6: 1,
          Acc: 1,
          Dec: 1,
          Duration: "1899-12-30T01:00:00",
        },
        {
          Player: "Wrong Drill",
          Drill: "Individual",
          TD: 8000,
          Z5: 1,
          Z6: 1,
          Acc: 1,
          Dec: 1,
          Duration: "1899-12-30T01:00:00",
        },
        {
          Player: "Wrong Drill",
          Drill: "First Half",
          TD: 100,
          Z5: 1,
          Z6: 1,
          Acc: 1,
          Dec: 1,
          Duration: "1899-12-30T00:50:52",
        },
      ]
    );
    expect(result.get("Wrong Drill")?.quality).toBe("match_zero");
  });

  const ET1 = {
    td: 800.25,
    z5: 40.5,
    z6: 10.25,
    acc: 6,
    dec: 5,
    duration: "1899-12-30T00:12:10",
  };
  const ET2 = {
    td: 750.75,
    z5: 35.25,
    z6: 8.5,
    acc: 4,
    dec: 3,
    duration: "1899-12-30T00:11:05",
  };

  it("ET: four valid segments sum exactly once (metrics + duration)", () => {
    const result = classifyMatchActualRowsByPlayer(
      ["Et Player"],
      [
        halfRow("Et Player", MATCH_ACTUAL_FIRST_HALF, DORU_1ST),
        halfRow("Et Player", MATCH_ACTUAL_SECOND_HALF, DORU_2ND),
        halfRow("Et Player", MATCH_ACTUAL_FIRST_EXTRA_TIME, ET1),
        halfRow("Et Player", MATCH_ACTUAL_SECOND_EXTRA_TIME, ET2),
      ]
    );
    const row = result.get("Et Player");
    expect(row?.quality).toBe("match_ok");
    expect(row?.halves).toEqual({
      first: "valid",
      second: "valid",
      firstExtraTime: "valid",
      secondExtraTime: "valid",
    });
    expect(row?.metrics?.totalDistance).toBeCloseTo(12593.73, 10);
    expect(row?.metrics?.hsr).toBeCloseTo(558.42, 10);
    expect(row?.metrics?.sprint).toBeCloseTo(88.53, 10);
    expect(row?.metrics?.accelerations).toBe(72);
    expect(row?.metrics?.decelerations).toBe(70);
    expect(row?.metrics?.durationSeconds).toBe(7370);
  });

  it("ET: missing Extra Time stays regulation-only match_ok (90-minute parity)", () => {
    const withEtAbsent = classifyMatchActualRowsByPlayer(
      ["Doru Andrei"],
      [
        halfRow("Doru Andrei", MATCH_ACTUAL_FIRST_HALF, DORU_1ST),
        halfRow("Doru Andrei", MATCH_ACTUAL_SECOND_HALF, DORU_2ND),
      ]
    ).get("Doru Andrei");
    expect(withEtAbsent?.quality).toBe("match_ok");
    expect(withEtAbsent?.metrics).toEqual({
      totalDistance: 11042.73,
      hsr: 482.67,
      sprint: 69.78,
      accelerations: 62,
      decelerations: 62,
      durationSeconds: 5975,
    });
    expect(withEtAbsent?.halves.firstExtraTime).toBe("absent");
    expect(withEtAbsent?.halves.secondExtraTime).toBe("absent");
  });

  it("ET: one Extra Time segment only is summed with regulation", () => {
    const result = classifyMatchActualRowsByPlayer(
      ["One Et"],
      [
        halfRow("One Et", MATCH_ACTUAL_FIRST_HALF, DORU_1ST),
        halfRow("One Et", MATCH_ACTUAL_SECOND_HALF, DORU_2ND),
        halfRow("One Et", MATCH_ACTUAL_FIRST_EXTRA_TIME, ET1),
      ]
    );
    const row = result.get("One Et");
    expect(row?.quality).toBe("match_ok");
    expect(row?.halves).toEqual({
      first: "valid",
      second: "valid",
      firstExtraTime: "valid",
      secondExtraTime: "absent",
    });
    expect(row?.metrics?.totalDistance).toBeCloseTo(11842.98, 10);
    expect(row?.metrics?.hsr).toBeCloseTo(523.17, 10);
    expect(row?.metrics?.sprint).toBeCloseTo(80.03, 10);
    expect(row?.metrics?.accelerations).toBe(68);
    expect(row?.metrics?.decelerations).toBe(67);
    expect(row?.metrics?.durationSeconds).toBe(6705);
  });

  it("ET: Extra Time only is match_ok, not match_zero", () => {
    const result = classifyMatchActualRowsByPlayer(
      ["Late Entry"],
      [halfRow("Late Entry", MATCH_ACTUAL_FIRST_EXTRA_TIME, ET1)]
    );
    expect(result.get("Late Entry")).toMatchObject({
      quality: "match_ok",
      halves: {
        first: "absent",
        second: "absent",
        firstExtraTime: "valid",
        secondExtraTime: "absent",
      },
      metrics: {
        totalDistance: 800.25,
        hsr: 40.5,
        sprint: 10.25,
        accelerations: 6,
        decelerations: 5,
        durationSeconds: 730,
      },
    });
  });

  it("ET: duplicate Extra Time segment is ambiguous, not summed", () => {
    const result = classifyMatchActualRowsByPlayer(
      ["Dup Et"],
      [
        halfRow("Dup Et", MATCH_ACTUAL_FIRST_HALF, DORU_1ST),
        halfRow("Dup Et", MATCH_ACTUAL_SECOND_HALF, DORU_2ND),
        halfRow("Dup Et", MATCH_ACTUAL_FIRST_EXTRA_TIME, ET1),
        halfRow("Dup Et", MATCH_ACTUAL_FIRST_EXTRA_TIME, ET2),
      ]
    );
    expect(result.get("Dup Et")).toEqual({
      playerName: "Dup Et",
      quality: "match_ambiguous",
      halves: {
        first: "valid",
        second: "valid",
        firstExtraTime: "ambiguous",
        secondExtraTime: "absent",
      },
      metrics: null,
    });
  });

  it("ET: malformed Extra Time Duration is data_issue even if regulation is valid", () => {
    const result = classifyMatchActualRowsByPlayer(
      ["Bad Et"],
      [
        halfRow("Bad Et", MATCH_ACTUAL_FIRST_HALF, DORU_1ST),
        halfRow("Bad Et", MATCH_ACTUAL_SECOND_HALF, DORU_2ND),
        halfRow("Bad Et", MATCH_ACTUAL_FIRST_EXTRA_TIME, {
          ...ET1,
          duration: "unparseable",
        }),
      ]
    );
    expect(result.get("Bad Et")).toEqual({
      playerName: "Bad Et",
      quality: "data_issue",
      halves: {
        first: "valid",
        second: "valid",
        firstExtraTime: "valid",
        secondExtraTime: "absent",
      },
      metrics: null,
    });
  });

  it("ET: Full Match / 90 Min aggregate drills are ignored", () => {
    const result = classifyMatchActualRowsByPlayer(
      ["Agg Player"],
      [
        {
          Player: "Agg Player",
          Drill: "Full Match",
          TD: 20000,
          Z5: 900,
          Z6: 200,
          Acc: 80,
          Dec: 80,
          Duration: "1899-12-30T02:00:00",
        },
        {
          Player: "Agg Player",
          Drill: "90 Min",
          TD: 18000,
          Z5: 800,
          Z6: 180,
          Acc: 70,
          Dec: 70,
          Duration: "1899-12-30T01:30:00",
        },
      ]
    );
    expect(result.get("Agg Player")?.quality).toBe("match_zero");
    expect(result.get("Agg Player")?.metrics).toEqual({
      totalDistance: 0,
      hsr: 0,
      sprint: 0,
      accelerations: 0,
      decelerations: 0,
      durationSeconds: 0,
    });
  });
});
