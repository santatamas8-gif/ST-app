import { describe, expect, it } from "vitest";
import { isRepsOnlyPullUpExercise } from "@/lib/strength/pullUpExercises";

describe("isRepsOnlyPullUpExercise", () => {
  it("matches bar and rings pull ups", () => {
    expect(isRepsOnlyPullUpExercise("Bar Pull Ups (Neutral)")).toBe(true);
    expect(isRepsOnlyPullUpExercise("Rings Pull Ups (Wide)")).toBe(true);
    expect(isRepsOnlyPullUpExercise("Towel Pull-ups")).toBe(true);
  });

  it("matches KB around-the-world reps-only (fixed %)", () => {
    expect(isRepsOnlyPullUpExercise("KB Around the World")).toBe(true);
    expect(isRepsOnlyPullUpExercise("KB around the word")).toBe(true);
  });

  it("matches dip exercises (reps only, no weight or % on card)", () => {
    expect(isRepsOnlyPullUpExercise("Ring Dips")).toBe(true);
    expect(isRepsOnlyPullUpExercise("Bar Dip")).toBe(true);
    expect(isRepsOnlyPullUpExercise("Parallel Bar Dips")).toBe(true);
    expect(isRepsOnlyPullUpExercise("Tricep Dips (Bench)")).toBe(true);
  });

  it("excludes pull downs and rows", () => {
    expect(isRepsOnlyPullUpExercise("Pull Down (Neutral)")).toBe(false);
    expect(isRepsOnlyPullUpExercise("Bent Over Row")).toBe(false);
  });
});
