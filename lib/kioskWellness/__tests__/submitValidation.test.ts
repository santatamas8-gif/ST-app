import { describe, expect, it } from "vitest";
import { validateKioskWellnessSubmitRequest } from "@/lib/kioskWellness/submitValidation";

const PLAYER_ID = "11111111-1111-4111-8111-111111111111";

function validEntry(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-07-06",
    entry: {
      playerId: PLAYER_ID,
      initials: "st",
      sleep_quality: 7,
      fatigue: 6,
      soreness: 5,
      stress: 4,
      mood: 8,
      bed_time: "22:30",
      wake_time: "07:00",
      illness: false,
      ...overrides,
    },
  };
}

describe("validateKioskWellnessSubmitRequest", () => {
  it("accepts a valid payload", () => {
    const result = validateKioskWellnessSubmitRequest(validEntry());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.entry.playerId).toBe(PLAYER_ID);
      expect(result.data.date).toBe("2026-07-06");
    }
  });

  it("rejects invalid scales", () => {
    const result = validateKioskWellnessSubmitRequest(validEntry({ mood: 11 }));
    expect(result).toEqual({ ok: false, error: "All wellness scales must be integers from 1 to 10." });
  });

  it("requires bed and wake times", () => {
    const result = validateKioskWellnessSubmitRequest(validEntry({ bed_time: "" }));
    expect(result.ok).toBe(false);
  });

  it("rejects missing entry", () => {
    const result = validateKioskWellnessSubmitRequest({ date: "2026-07-06" });
    expect(result.ok).toBe(false);
  });
});
