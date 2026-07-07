import { describe, expect, it } from "vitest";
import {
  calculateSetWeight,
  excelRound,
  formatDisplayWeight,
  inferLoadType,
  roundToIncrement,
} from "@/lib/strength/calculation";

describe("excelRound", () => {
  it("rounds 12.6 to 13", () => {
    expect(excelRound(12.6, 0)).toBe(13);
  });

  it("rounds 12.4 to 12", () => {
    expect(excelRound(12.4, 0)).toBe(12);
  });
});

describe("roundToIncrement", () => {
  it("rounds 25.2 with increment 2 to 26", () => {
    expect(roundToIncrement(25.2, 2)).toBe(26);
  });

  it("rounds 100.8 with increment 2.5 to 100", () => {
    expect(roundToIncrement(100.8, 2.5)).toBe(100);
  });

  it("rounds 95.2 with increment 2.5 to 95", () => {
    expect(roundToIncrement(95.2, 2.5)).toBe(95);
  });

  it("rounds 89.6 with increment 2.5 to 90", () => {
    expect(roundToIncrement(89.6, 2.5)).toBe(90);
  });
});

describe("Hip Thrust validation (Squat 140kg)", () => {
  const base = {
    referenceValue: 140,
    bodyweight: null as number | null,
    exercisePercent: 1.0,
    percentBwUsed: 0,
    rounding: 2.5,
  };

  it("Set 1: 72% → 100 kg", () => {
    const r = calculateSetWeight({ ...base, setPercentage: 72 });
    expect(r.roundedWeight).toBe(100);
  });

  it("Set 2: 68% → 95 kg", () => {
    const r = calculateSetWeight({ ...base, setPercentage: 68 });
    expect(r.roundedWeight).toBe(95);
  });

  it("Set 3: 64% → 90 kg", () => {
    const r = calculateSetWeight({ ...base, setPercentage: 64 });
    expect(r.roundedWeight).toBe(90);
  });
});

describe("DB Split Squat validation (Squat 140kg, 0.25%, rounding 2)", () => {
  const base = {
    referenceValue: 140,
    bodyweight: null as number | null,
    exercisePercent: 0.25,
    percentBwUsed: 0,
    rounding: 2,
  };

  it("Set 1: 72% → 26 kg/hand", () => {
    const r = calculateSetWeight({ ...base, setPercentage: 72 });
    expect(r.roundedWeight).toBe(26);
    expect(
      formatDisplayWeight(r.roundedWeight, inferLoadType("each dumbbell", "Dumbbell"))
    ).toBe("26 kg/hand");
  });

  it("Set 2: 68% → 24 kg/hand", () => {
    const r = calculateSetWeight({ ...base, setPercentage: 68 });
    expect(r.roundedWeight).toBe(24);
  });

  it("Set 3: 64% → 22 kg/hand", () => {
    const r = calculateSetWeight({ ...base, setPercentage: 64 });
    expect(r.roundedWeight).toBe(22);
  });
});

describe("inferLoadType", () => {
  it("detects dumbbell each hand from Excel typo", () => {
    expect(inferLoadType("* Each dumbell", "Dumbells")).toBe("dumbbell_each");
  });

  it("defaults to barbell", () => {
    expect(inferLoadType("", "Barbell")).toBe("barbell");
  });
});
