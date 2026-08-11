import { describe, expect, it } from "vitest";
import {
  canAccessMatchFeedback,
  canCreateMatchFeedback,
  canSubmitMatchFeedbackResponse,
} from "@/lib/matchFeedback/auth";
import { matchFeedbackParticipantCounts } from "@/lib/matchFeedback/counters";
import {
  validateCreateMatchPlayers,
  validateCreateMatchRequest,
} from "@/lib/matchFeedback/createValidation";
import { isMatchFeedbackFormReady } from "@/lib/matchFeedback/questionnaireReady";
import {
  normalizePreMatchOtherText,
  validateSubmitMatchFeedbackRequest,
} from "@/lib/matchFeedback/submitValidation";

const PLAYER_A = "11111111-1111-4111-8111-111111111111";
const PLAYER_B = "22222222-2222-4222-8222-222222222222";
const STAFF_ID = "33333333-3333-4333-8333-333333333333";
const MATCH_ID = "44444444-4444-4444-8444-444444444444";

describe("matchFeedback auth (service-role write gate)", () => {
  it("allows only admin to create matches", () => {
    expect(canCreateMatchFeedback("admin")).toBe(true);
    expect(canCreateMatchFeedback("staff")).toBe(false);
    expect(canCreateMatchFeedback("player")).toBe(false);
    expect(canCreateMatchFeedback(null)).toBe(false);
  });

  it("allows admin and staff to access / submit, never player", () => {
    expect(canAccessMatchFeedback("admin")).toBe(true);
    expect(canAccessMatchFeedback("staff")).toBe(true);
    expect(canAccessMatchFeedback("player")).toBe(false);
    expect(canSubmitMatchFeedbackResponse("admin")).toBe(true);
    expect(canSubmitMatchFeedbackResponse("staff")).toBe(true);
    expect(canSubmitMatchFeedbackResponse("player")).toBe(false);
  });
});

describe("validateCreateMatchRequest", () => {
  it("accepts a valid admin create payload", () => {
    const result = validateCreateMatchRequest({
      opponent: "FCSB",
      matchDate: "2026-08-11",
      matchday: 4,
      playerIds: [PLAYER_A, PLAYER_B],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.opponent).toBe("FCSB");
      expect(result.data.playerIds).toEqual([PLAYER_A, PLAYER_B]);
    }
  });

  it("rejects empty opponent, invalid date, bad matchday, empty/duplicate players", () => {
    expect(validateCreateMatchRequest({ opponent: "  ", matchDate: "2026-08-11", matchday: 1, playerIds: [PLAYER_A] }).ok).toBe(false);
    expect(validateCreateMatchRequest({ opponent: "X", matchDate: "11-08-2026", matchday: 1, playerIds: [PLAYER_A] }).ok).toBe(false);
    expect(validateCreateMatchRequest({ opponent: "X", matchDate: "2026-08-11", matchday: 0, playerIds: [PLAYER_A] }).ok).toBe(false);
    expect(validateCreateMatchRequest({ opponent: "X", matchDate: "2026-08-11", matchday: 1, playerIds: [] }).ok).toBe(false);
    expect(
      validateCreateMatchRequest({
        opponent: "X",
        matchDate: "2026-08-11",
        matchday: 1,
        playerIds: [PLAYER_A, PLAYER_A],
      }).ok
    ).toBe(false);
  });
});

describe("validateCreateMatchPlayers", () => {
  it("rejects missing, staff, or admin profiles", () => {
    expect(
      validateCreateMatchPlayers([PLAYER_A], [{ id: PLAYER_A, role: "player" }]).ok
    ).toBe(true);
    expect(validateCreateMatchPlayers([PLAYER_A], []).ok).toBe(false);
    expect(
      validateCreateMatchPlayers([STAFF_ID], [{ id: STAFF_ID, role: "staff" }]).ok
    ).toBe(false);
    expect(
      validateCreateMatchPlayers([STAFF_ID], [{ id: STAFF_ID, role: "admin" }]).ok
    ).toBe(false);
  });
});

describe("validateSubmitMatchFeedbackRequest", () => {
  const base = {
    matchId: MATCH_ID,
    playerId: PLAYER_A,
    preMatchFeelings: ["Prepared", "Fresh"],
    physicalDemand: 7,
    performanceRating: 8,
    physicalDropoff: "60–75 min",
    mentalDemand: 6,
  };

  it("accepts multi-select Q1 and required scales", () => {
    const result = validateSubmitMatchFeedbackRequest(base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.preMatchFeelings).toEqual(["Prepared", "Fresh"]);
      expect(result.data.preMatchOtherText).toBeNull();
    }
  });

  it("rejects invalid Q1 option and empty feelings", () => {
    expect(
      validateSubmitMatchFeedbackRequest({ ...base, preMatchFeelings: ["Prepared", "Hack"] }).ok
    ).toBe(false);
    expect(validateSubmitMatchFeedbackRequest({ ...base, preMatchFeelings: [] }).ok).toBe(false);
  });

  it("requires Other text when Other selected; clears when not", () => {
    expect(
      validateSubmitMatchFeedbackRequest({
        ...base,
        preMatchFeelings: ["Other"],
        preMatchOtherText: "   ",
      }).ok
    ).toBe(false);
    expect(
      validateSubmitMatchFeedbackRequest({
        ...base,
        preMatchFeelings: ["Other"],
      }).ok
    ).toBe(false);
    const withOther = validateSubmitMatchFeedbackRequest({
      ...base,
      preMatchFeelings: ["Tired", "Other"],
      preMatchOtherText: "  Ankle niggle  ",
    });
    expect(withOther.ok).toBe(true);
    if (withOther.ok) {
      expect(withOther.data.preMatchOtherText).toBe("Ankle niggle");
    }
    const cleared = normalizePreMatchOtherText(["Prepared"], "ignored");
    expect(cleared.ok).toBe(true);
    if (cleared.ok) expect(cleared.value).toBeNull();
  });

  it("limits Q2/Q3/Q5 to 1–10 and Q4 to approved values", () => {
    expect(validateSubmitMatchFeedbackRequest({ ...base, physicalDemand: 0 }).ok).toBe(false);
    expect(validateSubmitMatchFeedbackRequest({ ...base, physicalDemand: 11 }).ok).toBe(false);
    expect(validateSubmitMatchFeedbackRequest({ ...base, performanceRating: 1.5 }).ok).toBe(false);
    expect(validateSubmitMatchFeedbackRequest({ ...base, mentalDemand: 99 }).ok).toBe(false);
    expect(validateSubmitMatchFeedbackRequest({ ...base, physicalDropoff: "Half time" }).ok).toBe(false);
  });

  it("rejects unanswered Q2/Q3/Q5 with no default 5", () => {
    expect(validateSubmitMatchFeedbackRequest({ ...base, physicalDemand: null }).ok).toBe(false);
    expect(validateSubmitMatchFeedbackRequest({ ...base, physicalDemand: undefined }).ok).toBe(false);
    expect(validateSubmitMatchFeedbackRequest({ ...base, performanceRating: null }).ok).toBe(false);
    expect(validateSubmitMatchFeedbackRequest({ ...base, mentalDemand: null }).ok).toBe(false);
    expect(
      validateSubmitMatchFeedbackRequest({
        matchId: MATCH_ID,
        playerId: PLAYER_A,
        preMatchFeelings: ["Prepared"],
        physicalDropoff: "60–75 min",
      }).ok
    ).toBe(false);
  });

  it("requires all questions", () => {
    expect(validateSubmitMatchFeedbackRequest({ ...base, physicalDemand: undefined }).ok).toBe(false);
  });
});

describe("isMatchFeedbackFormReady", () => {
  const ready = {
    feelings: ["Prepared" as const],
    otherText: "",
    physicalDemand: 7,
    performanceRating: 8,
    dropoff: "60–75 min" as const,
    mentalDemand: 6,
  };

  it("requires active Q2/Q3/Q5 selection (null is not ready)", () => {
    expect(isMatchFeedbackFormReady(ready)).toBe(true);
    expect(isMatchFeedbackFormReady({ ...ready, physicalDemand: null })).toBe(false);
    expect(isMatchFeedbackFormReady({ ...ready, performanceRating: null })).toBe(false);
    expect(isMatchFeedbackFormReady({ ...ready, mentalDemand: null })).toBe(false);
    expect(isMatchFeedbackFormReady({ ...ready, dropoff: null })).toBe(false);
    expect(isMatchFeedbackFormReady({ ...ready, feelings: [] })).toBe(false);
  });
});

describe("matchFeedbackParticipantCounts", () => {
  it("counts only selected participants", () => {
    expect(matchFeedbackParticipantCounts([PLAYER_A, PLAYER_B], [PLAYER_A])).toEqual({
      total: 2,
      completed: 1,
      missing: 1,
    });
    expect(matchFeedbackParticipantCounts([PLAYER_A], [PLAYER_A, PLAYER_B])).toEqual({
      total: 1,
      completed: 1,
      missing: 0,
    });
    expect(matchFeedbackParticipantCounts([], [])).toEqual({
      total: 0,
      completed: 0,
      missing: 0,
    });
  });
});
