import { describe, expect, it, vi } from "vitest";
import {
  buildCompletedSubmitEntries,
  buildKioskSubmitRequest,
  matchdayTagToApi,
} from "@/lib/kioskRpe/buildSubmitPayload";
import { createDefaultPlayerState, updatePlayerRpe } from "@/lib/kioskRpe/state";
import { PLAYER_A, PLAYER_B } from "./fixtures";

vi.mock("@/lib/kioskRpe/localDate", () => ({
  getLocalDateString: () => "2026-06-17",
}));

describe("buildSubmitPayload", () => {
  it('maps "No tag" to null', () => {
    expect(matchdayTagToApi("No tag")).toBeNull();
    expect(matchdayTagToApi("MD-3")).toBe("MD-3");
  });

  it("includes only completed players", () => {
    const states = {
      [PLAYER_A]: { ...createDefaultPlayerState(PLAYER_A), rpe: 7 as const },
      [PLAYER_B]: createDefaultPlayerState(PLAYER_B),
    };
    const durationInputs = {
      [PLAYER_A]: "75",
      [PLAYER_B]: "75",
    };

    const entries = buildCompletedSubmitEntries(
      [PLAYER_A, PLAYER_B],
      states,
      durationInputs
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].playerId).toBe(PLAYER_A);
  });

  it("excludes missing players and omits non-submit fields", () => {
    const states = {
      [PLAYER_A]: { ...createDefaultPlayerState(PLAYER_A), rpe: 5 as const, sessionType: "Gym" as const },
    };
    const entries = buildCompletedSubmitEntries([PLAYER_A], states, { [PLAYER_A]: "40" });
    const entry = entries[0];

    expect(entry).toEqual({
      playerId: PLAYER_A,
      rpe: 5,
      durationMinutes: 40,
      sessionType: "Gym",
      matchdayTag: "MD-3",
    });
    expect(entry).not.toHaveProperty("playerName");
    expect(entry).not.toHaveProperty("avatar");
    expect(entry).not.toHaveProperty("load");
    expect(entry).not.toHaveProperty("status");
  });

  it("builds request with local date and completed entries", () => {
    const states = updatePlayerRpe(
      { [PLAYER_A]: createDefaultPlayerState(PLAYER_A) },
      PLAYER_A,
      7
    );
    const request = buildKioskSubmitRequest([PLAYER_A], states, { [PLAYER_A]: "75" });

    expect(request.date).toBe("2026-06-17");
    expect(request.entries[0].matchdayTag).toBe("MD-3");
  });

  it("stores null matchday when player selected No tag", () => {
    const state = {
      ...createDefaultPlayerState(PLAYER_A),
      rpe: 6 as const,
      matchdayTag: "No tag" as const,
    };
    const entries = buildCompletedSubmitEntries([PLAYER_A], { [PLAYER_A]: state }, { [PLAYER_A]: "30" });
    expect(entries[0].matchdayTag).toBeNull();
  });

  it("includes existing session ID for locked existing submissions", () => {
    const state = {
      ...createDefaultPlayerState(PLAYER_A),
      rpe: 7 as const,
      source: "existingSubmission" as const,
      existingSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    };
    const entries = buildCompletedSubmitEntries([PLAYER_A], { [PLAYER_A]: state }, { [PLAYER_A]: "75" });

    expect(entries[0].existingSessionId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });
});
