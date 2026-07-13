import { describe, expect, it } from "vitest";
import { SESSION_TYPES } from "@/lib/kioskRpe/constants";
import {
  KIOSK_MATCHDAY_DB_VALUES,
  validateKioskRpeSubmitRequest,
} from "@/lib/kioskRpe/submitValidation";
import { PLAYER_A, PLAYER_B } from "./fixtures";

const VALID_PLAYER = PLAYER_A;
const OTHER_PLAYER = PLAYER_B;

function validEntry(overrides: Record<string, unknown> = {}) {
  return {
    playerId: VALID_PLAYER,
    rpe: 7,
    durationMinutes: 75,
    sessionType: "Pitch",
    matchdayTag: "MD-3",
    ...overrides,
  };
}

describe("validateKioskRpeSubmitRequest invalid cases", () => {
  it("rejects missing body", () => {
    expect(validateKioskRpeSubmitRequest(null).ok).toBe(false);
    expect(validateKioskRpeSubmitRequest(undefined).ok).toBe(false);
  });

  it("rejects invalid date format and impossible calendar date", () => {
    expect(validateKioskRpeSubmitRequest({ date: "06-17-2026", entries: [validEntry()] }).ok).toBe(
      false
    );
    expect(validateKioskRpeSubmitRequest({ date: "2026-02-30", entries: [validEntry()] }).ok).toBe(
      false
    );
  });

  it("rejects empty entries and too many entries", () => {
    expect(validateKioskRpeSubmitRequest({ date: "2026-06-17", entries: [] }).ok).toBe(false);
    const tooMany = Array.from({ length: 101 }, (_, i) =>
      validEntry({
        playerId: `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
      })
    );
    expect(validateKioskRpeSubmitRequest({ date: "2026-06-17", entries: tooMany }).ok).toBe(false);
  });

  it("rejects duplicate player IDs and malformed UUID", () => {
    expect(
      validateKioskRpeSubmitRequest({
        date: "2026-06-17",
        entries: [validEntry(), validEntry({ playerId: VALID_PLAYER })],
      }).ok
    ).toBe(false);
    expect(
      validateKioskRpeSubmitRequest({
        date: "2026-06-17",
        entries: [validEntry({ playerId: "not-a-uuid" })],
      }).ok
    ).toBe(false);
    expect(
      validateKioskRpeSubmitRequest({
        date: "2026-06-17",
        entries: [validEntry({ existingSessionId: "not-a-uuid" })],
      }).ok
    ).toBe(false);
  });

  it("rejects invalid RPE values", () => {
    expect(validateKioskRpeSubmitRequest({ date: "2026-06-17", entries: [validEntry({ rpe: 0 })] }).ok).toBe(
      false
    );
    expect(validateKioskRpeSubmitRequest({ date: "2026-06-17", entries: [validEntry({ rpe: 11 })] }).ok).toBe(
      false
    );
    expect(
      validateKioskRpeSubmitRequest({ date: "2026-06-17", entries: [validEntry({ rpe: 7.5 })] }).ok
    ).toBe(false);
  });

  it("rejects invalid duration values", () => {
    expect(
      validateKioskRpeSubmitRequest({ date: "2026-06-17", entries: [validEntry({ durationMinutes: 0 })] })
        .ok
    ).toBe(false);
    expect(
      validateKioskRpeSubmitRequest({ date: "2026-06-17", entries: [validEntry({ durationMinutes: 301 })] })
        .ok
    ).toBe(false);
    expect(
      validateKioskRpeSubmitRequest({ date: "2026-06-17", entries: [validEntry({ durationMinutes: 75.5 })] })
        .ok
    ).toBe(false);
  });

  it("rejects invalid session type and matchday tag", () => {
    expect(
      validateKioskRpeSubmitRequest({
        date: "2026-06-17",
        entries: [validEntry({ sessionType: "Invalid" })],
      }).ok
    ).toBe(false);
    expect(
      validateKioskRpeSubmitRequest({
        date: "2026-06-17",
        entries: [validEntry({ matchdayTag: "MD-9" })],
      }).ok
    ).toBe(false);
    expect(
      validateKioskRpeSubmitRequest({
        date: "2026-06-17",
        entries: [validEntry({ matchdayTag: "No tag" })],
      }).ok
    ).toBe(false);
  });
});

describe("validateKioskRpeSubmitRequest valid cases", () => {
  it("accepts one and several valid entries", () => {
    const one = validateKioskRpeSubmitRequest({ date: "2026-06-17", entries: [validEntry()] });
    expect(one.ok).toBe(true);

    const many = validateKioskRpeSubmitRequest({
      date: "2026-06-17",
      entries: [validEntry(), validEntry({ playerId: OTHER_PLAYER, rpe: 5 })],
    });
    expect(many.ok).toBe(true);
  });

  it("accepts a valid existing session ID for mixed Kiosk batches", () => {
    const result = validateKioskRpeSubmitRequest({
      date: "2026-06-17",
      entries: [validEntry({ existingSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.entries[0].existingSessionId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    }
  });

  it("accepts null matchday tag and all supported values", () => {
    const nullTag = validateKioskRpeSubmitRequest({
      date: "2026-06-17",
      entries: [validEntry({ matchdayTag: null })],
    });
    expect(nullTag.ok).toBe(true);

    for (const sessionType of SESSION_TYPES) {
      const result = validateKioskRpeSubmitRequest({
        date: "2026-06-17",
        entries: [validEntry({ sessionType })],
      });
      expect(result.ok).toBe(true);
    }

    for (const matchdayTag of KIOSK_MATCHDAY_DB_VALUES) {
      const result = validateKioskRpeSubmitRequest({
        date: "2026-06-17",
        entries: [validEntry({ matchdayTag })],
      });
      expect(result.ok).toBe(true);
    }
  });
});
