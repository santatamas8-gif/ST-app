import { describe, expect, it } from "vitest";
import { getRpeMeaning, parseDurationInput } from "@/lib/kioskRpe/constants";
import { sessionLoad } from "@/utils/load";

describe("RPE meanings", () => {
  it.each([
    [1, "Easy"],
    [2, "Easy"],
    [3, "Moderate"],
    [4, "Moderate"],
    [5, "Hard"],
    [6, "Hard"],
    [7, "Very hard"],
    [8, "Very hard"],
    [9, "Extremely hard"],
    [10, "Maximal"],
  ])("maps RPE %i to %s", (rpe, label) => {
    expect(getRpeMeaning(rpe)).toBe(label);
  });
});

describe("sessionLoad", () => {
  it("calculates 75 × 7 = 525", () => {
    expect(sessionLoad(75, 7)).toBe(525);
  });

  it("calculates 40 × 4 = 160", () => {
    expect(sessionLoad(40, 4)).toBe(160);
  });

  it("calculates 55 × 6 = 330", () => {
    expect(sessionLoad(55, 6)).toBe(330);
  });
});

describe("parseDurationInput", () => {
  it.each([
    ["", null],
    ["0", null],
    ["-5", null],
    ["75.5", null],
    ["301", null],
    ["1", 1],
    ["75", 75],
    ["300", 300],
  ])("parses %j as %j", (input, expected) => {
    expect(parseDurationInput(input)).toBe(expected);
  });
});
