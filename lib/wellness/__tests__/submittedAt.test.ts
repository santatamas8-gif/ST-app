import { describe, expect, it } from "vitest";
import { formatWellnessSubmittedAt } from "@/lib/wellness/submittedAt";

describe("formatWellnessSubmittedAt", () => {
  it("shows the club-local date and hour", () => {
    expect(formatWellnessSubmittedAt("2026-11-15T06:42:00.000Z")).toBe("Submitted 15 Nov 2026, 08:42");
  });

  it("returns null when the timestamp is missing or invalid", () => {
    expect(formatWellnessSubmittedAt(null)).toBeNull();
    expect(formatWellnessSubmittedAt(undefined)).toBeNull();
    expect(formatWellnessSubmittedAt("")).toBeNull();
    expect(formatWellnessSubmittedAt("not-a-date")).toBeNull();
  });
});
