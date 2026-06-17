import { describe, expect, it } from "vitest";
import { buildKioskInsertRows } from "@/lib/kioskRpe/buildKioskInsertRows";
import type { KioskRpeSubmitEntry } from "@/lib/kioskRpe/submitValidation";
import type { SessionFormInput } from "@/lib/types";
import { PLAYER_A, PLAYER_B, PLAYER_C } from "./fixtures";

const BATCH_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BATCH_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const entries: KioskRpeSubmitEntry[] = [
  {
    playerId: PLAYER_A,
    rpe: 7,
    durationMinutes: 75,
    sessionType: "Pitch",
    matchdayTag: "MD-3",
  },
  {
    playerId: PLAYER_B,
    rpe: 5,
    durationMinutes: 40,
    sessionType: "Gym",
    matchdayTag: "MD",
  },
  {
    playerId: PLAYER_C,
    rpe: 8,
    durationMinutes: 30,
    sessionType: "Rehab",
    matchdayTag: null,
  },
];

describe("buildKioskInsertRows", () => {
  it("assigns one shared kiosk batch ID while preserving submitted values", () => {
    const rows = buildKioskInsertRows({
      date: "2026-06-17",
      entries,
      kioskBatchId: BATCH_A,
    });

    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.kiosk_batch_id === BATCH_A)).toBe(true);
    expect(rows.map((row) => row.user_id)).toEqual([PLAYER_A, PLAYER_B, PLAYER_C]);
    expect(rows.map((row) => row.rpe)).toEqual([7, 5, 8]);
    expect(rows.map((row) => row.duration)).toEqual([75, 40, 30]);
    expect(rows.map((row) => row.load)).toEqual([525, 200, 240]);
    expect(rows.map((row) => row.session_type)).toEqual(["Pitch", "Gym", "Rehab"]);
    expect(rows.map((row) => row.matchday_tag)).toEqual(["MD-3", "MD", null]);
  });

  it("uses the supplied batch ID per request without leaking another request ID", () => {
    const firstRequestRows = buildKioskInsertRows({
      date: "2026-06-17",
      entries: entries.slice(0, 2),
      kioskBatchId: BATCH_A,
    });
    const secondRequestRows = buildKioskInsertRows({
      date: "2026-06-17",
      entries: entries.slice(2),
      kioskBatchId: BATCH_B,
    });

    expect(BATCH_A).not.toBe(BATCH_B);
    expect(firstRequestRows.every((row) => row.kiosk_batch_id === BATCH_A)).toBe(true);
    expect(firstRequestRows.every((row) => row.kiosk_batch_id !== BATCH_B)).toBe(true);
    expect(secondRequestRows.every((row) => row.kiosk_batch_id === BATCH_B)).toBe(true);
  });

  it("does not require kiosk batch metadata for normal player RPE input", () => {
    const playerForm: SessionFormInput = {
      date: "2026-06-17",
      duration: 75,
      rpe: 7,
    };

    expect("kiosk_batch_id" in playerForm).toBe(false);
  });
});
