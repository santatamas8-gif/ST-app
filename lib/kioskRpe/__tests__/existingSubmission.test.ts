import { describe, expect, it } from "vitest";
import {
  buildExistingSubmissionMap,
  buildMixedKioskBatchRows,
  classifyEligibleSameDayPhoneSubmissions,
  createExistingSubmissionPlayerState,
  isEligibleSameDayPhoneSubmission,
  isExistingSubmissionLocked,
  type ExistingKioskSubmissionRow,
} from "@/lib/kioskRpe/existingSubmission";
import { updatePlayerRpe } from "@/lib/kioskRpe/state";
import type { KioskRpeSubmitEntry } from "@/lib/kioskRpe/submitValidation";
import { PLAYER_A, PLAYER_B, PLAYER_C, PLAYER_D } from "./fixtures";

const DATE = "2026-06-18";
const BATCH_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function row(overrides: Partial<ExistingKioskSubmissionRow> & Pick<ExistingKioskSubmissionRow, "id">): ExistingKioskSubmissionRow {
  return {
    id: overrides.id,
    user_id: overrides.user_id ?? PLAYER_A,
    date: overrides.date ?? DATE,
    duration: overrides.duration ?? 70,
    rpe: overrides.rpe ?? 7,
    load: overrides.load ?? 490,
    session_type: "session_type" in overrides ? overrides.session_type : null,
    matchday_tag: "matchday_tag" in overrides ? overrides.matchday_tag : null,
    kiosk_batch_id: "kiosk_batch_id" in overrides ? overrides.kiosk_batch_id : null,
    created_at: overrides.created_at,
  };
}

function entry(overrides: Partial<KioskRpeSubmitEntry> & Pick<KioskRpeSubmitEntry, "playerId">): KioskRpeSubmitEntry {
  return {
    playerId: overrides.playerId,
    rpe: overrides.rpe ?? 5,
    durationMinutes: overrides.durationMinutes ?? 75,
    sessionType: overrides.sessionType ?? "Pitch",
    matchdayTag: "matchdayTag" in overrides ? overrides.matchdayTag! : "MD-3",
    existingSessionId: overrides.existingSessionId,
  };
}

describe("existing same-day phone submission eligibility", () => {
  it("treats same player, same date and unassigned no-metadata row as eligible", () => {
    expect(isEligibleSameDayPhoneSubmission(row({ id: "s1" }), { playerId: PLAYER_A, date: DATE })).toBe(true);
  });

  it("ignores another date, another player and already batched rows", () => {
    expect(isEligibleSameDayPhoneSubmission(row({ id: "s1", date: "2026-06-17" }), { playerId: PLAYER_A, date: DATE })).toBe(false);
    expect(isEligibleSameDayPhoneSubmission(row({ id: "s2", user_id: PLAYER_B }), { playerId: PLAYER_A, date: DATE })).toBe(false);
    expect(isEligibleSameDayPhoneSubmission(row({ id: "s3", kiosk_batch_id: BATCH_ID }), { playerId: PLAYER_A, date: DATE })).toBe(false);
  });

  it("classifies zero, one and multiple eligible rows", () => {
    expect(classifyEligibleSameDayPhoneSubmissions([], { playerId: PLAYER_A, date: DATE }).status).toBe("none");
    expect(classifyEligibleSameDayPhoneSubmissions([row({ id: "s1" })], { playerId: PLAYER_A, date: DATE }).status).toBe("single");
    expect(classifyEligibleSameDayPhoneSubmissions([row({ id: "s1" }), row({ id: "s2" })], { playerId: PLAYER_A, date: DATE }).status).toBe("multiple");
  });

  it("builds one map entry and reports duplicate conflicts", () => {
    const result = buildExistingSubmissionMap(
      [row({ id: "a", user_id: PLAYER_A }), row({ id: "b", user_id: PLAYER_B }), row({ id: "c", user_id: PLAYER_B })],
      [{ id: PLAYER_A }, { id: PLAYER_B }, { id: PLAYER_C }],
      DATE
    );

    expect(result.submissions[PLAYER_A]?.id).toBe("a");
    expect(result.submissions[PLAYER_C]).toBeUndefined();
    expect(result.conflictPlayerIds).toEqual([PLAYER_B]);
  });
});

describe("existing same-day phone submission Kiosk state", () => {
  it("initializes completed locked state with stored RPE", () => {
    const state = createExistingSubmissionPlayerState(PLAYER_A, row({ id: "s1", rpe: 8 }), {
      sessionType: "Pitch",
      matchdayTag: "MD-3",
      duration: 75,
    });

    expect(state).toMatchObject({
      playerId: PLAYER_A,
      rpe: 8,
      duration: 75,
      source: "existingSubmission",
      existingSessionId: "s1",
    });
    expect(isExistingSubmissionLocked(state)).toBe(true);
    expect(updatePlayerRpe({ [PLAYER_A]: state }, PLAYER_A, 3)[PLAYER_A].rpe).toBe(8);
  });
});

describe("mixed Kiosk batch rows", () => {
  it("overwrites phone duration and load using stored RPE", () => {
    const rows = buildMixedKioskBatchRows({
      date: DATE,
      entries: [entry({ playerId: PLAYER_A, rpe: 2, durationMinutes: 75, existingSessionId: "s1" })],
      existingRowsByPlayerId: { [PLAYER_A]: row({ id: "s1", rpe: 7, duration: 70, load: 490 }) },
      kioskBatchId: BATCH_ID,
    });

    expect(rows.updates).toEqual([
      {
        id: "s1",
        user_id: PLAYER_A,
        date: DATE,
        duration: 75,
        rpe: 7,
        load: 525,
        session_type: "Pitch",
        matchday_tag: "MD-3",
        kiosk_batch_id: BATCH_ID,
      },
    ]);
    expect(rows.inserts).toHaveLength(0);
  });

  it("uses per-player duration and metadata override values", () => {
    const rows = buildMixedKioskBatchRows({
      date: DATE,
      entries: [entry({ playerId: PLAYER_A, durationMinutes: 40, sessionType: "Gym", matchdayTag: "MD-1" })],
      existingRowsByPlayerId: { [PLAYER_A]: row({ id: "s1", rpe: 6 }) },
      kioskBatchId: BATCH_ID,
    });

    expect(rows.updates[0]).toMatchObject({
      duration: 40,
      rpe: 6,
      load: 240,
      session_type: "Gym",
      matchday_tag: "MD-1",
      kiosk_batch_id: BATCH_ID,
    });
  });

  it("builds mixed updates and inserts with one common batch ID", () => {
    const entries = [
      entry({ playerId: PLAYER_A }),
      entry({ playerId: PLAYER_B }),
      entry({ playerId: PLAYER_C, rpe: 6 }),
      entry({ playerId: PLAYER_D, rpe: 4, durationMinutes: 30 }),
    ];
    const rows = buildMixedKioskBatchRows({
      date: DATE,
      entries,
      existingRowsByPlayerId: {
        [PLAYER_A]: row({ id: "a", user_id: PLAYER_A, rpe: 7 }),
        [PLAYER_B]: row({ id: "b", user_id: PLAYER_B, rpe: 5 }),
      },
      kioskBatchId: BATCH_ID,
    });

    expect(rows.updates).toHaveLength(2);
    expect(rows.inserts).toHaveLength(2);
    expect([...rows.updates, ...rows.inserts].every((item) => item.kiosk_batch_id === BATCH_ID)).toBe(true);
    expect(rows.updates.map((item) => item.user_id)).toEqual([PLAYER_A, PLAYER_B]);
    expect(rows.inserts.map((item) => item.user_id)).toEqual([PLAYER_C, PLAYER_D]);
  });
});
