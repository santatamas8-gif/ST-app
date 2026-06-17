import { describe, expect, it } from "vitest";
import {
  applySettingsToAll,
  createDefaultPlayerState,
  createInitialDurationInputs,
  createInitialPlayerStates,
  isKioskPlayerCompleted,
  syncAllDurationInputs,
  updatePlayerRpe,
  updatePlayerSettings,
} from "@/lib/kioskRpe/state";
import { PLAYER_A, PLAYER_B } from "./fixtures";

describe("kiosk state helpers", () => {
  it("creates default player state with Pitch / MD-3 / 75 / null RPE", () => {
    expect(createDefaultPlayerState(PLAYER_A)).toEqual({
      playerId: PLAYER_A,
      sessionType: "Pitch",
      matchdayTag: "MD-3",
      duration: 75,
      rpe: null,
    });
  });

  it("includes every player ID exactly once", () => {
    const states = createInitialPlayerStates([{ id: PLAYER_A }, { id: PLAYER_B }]);
    expect(Object.keys(states)).toEqual([PLAYER_A, PLAYER_B]);
    expect(states[PLAYER_A].playerId).toBe(PLAYER_A);
    expect(states[PLAYER_B].playerId).toBe(PLAYER_B);
  });

  it("preserves existing player values when roster grows", () => {
    let states = createInitialPlayerStates([{ id: PLAYER_A }]);
    states = updatePlayerRpe(states, PLAYER_A, 6);
    states = updatePlayerSettings(states, PLAYER_A, { duration: 90 });

    const synced = createInitialPlayerStates([{ id: PLAYER_A }, { id: PLAYER_B }], states);

    expect(synced[PLAYER_A].rpe).toBe(6);
    expect(synced[PLAYER_A].duration).toBe(90);
    expect(synced[PLAYER_B].rpe).toBeNull();
    expect(synced[PLAYER_B].duration).toBe(75);
  });

  it("drops state for players no longer in the roster", () => {
    const states = createInitialPlayerStates([{ id: PLAYER_A }, { id: PLAYER_B }]);
    const synced = createInitialPlayerStates([{ id: PLAYER_A }], states);

    expect(Object.keys(synced)).toEqual([PLAYER_A]);
    expect(synced[PLAYER_B]).toBeUndefined();
  });

  it("Apply All updates session fields but preserves RPE", () => {
    let states = createInitialPlayerStates([{ id: PLAYER_A }, { id: PLAYER_B }]);
    states = updatePlayerRpe(states, PLAYER_A, 7);
    states = applySettingsToAll(states, {
      sessionType: "Gym",
      matchdayTag: "MD",
      duration: 60,
    });

    expect(states[PLAYER_A].rpe).toBe(7);
    expect(states[PLAYER_A].sessionType).toBe("Gym");
    expect(states[PLAYER_A].matchdayTag).toBe("MD");
    expect(states[PLAYER_A].duration).toBe(60);
    expect(states[PLAYER_B].rpe).toBeNull();
    expect(states[PLAYER_B].duration).toBe(60);
  });

  it("updates only one player settings via override", () => {
    const states = createInitialPlayerStates([{ id: PLAYER_A }, { id: PLAYER_B }]);
    const next = updatePlayerSettings(states, PLAYER_B, {
      sessionType: "Recovery",
      duration: 45,
    });

    expect(next[PLAYER_A].sessionType).toBe("Pitch");
    expect(next[PLAYER_B].sessionType).toBe("Recovery");
    expect(next[PLAYER_B].duration).toBe(45);
  });

  it("updates RPE for only the selected player", () => {
    const states = createInitialPlayerStates([{ id: PLAYER_A }, { id: PLAYER_B }]);
    const next = updatePlayerRpe(states, PLAYER_A, 8);

    expect(next[PLAYER_A].rpe).toBe(8);
    expect(next[PLAYER_B].rpe).toBeNull();
  });

  it("syncs duration inputs for all players", () => {
    const inputs = syncAllDurationInputs([PLAYER_A, PLAYER_B], 60, { [PLAYER_A]: "75" });
    expect(inputs[PLAYER_A]).toBe("60");
    expect(inputs[PLAYER_B]).toBe("60");
  });

  it("initializes duration inputs with fallback", () => {
    const inputs = createInitialDurationInputs([{ id: PLAYER_A }]);
    expect(inputs[PLAYER_A]).toBe("75");
  });

  it("marks player Missing without RPE", () => {
    const state = createDefaultPlayerState(PLAYER_A);
    expect(isKioskPlayerCompleted(state, "75")).toBe(false);
  });

  it("marks player Completed with valid RPE and duration", () => {
    const state = { ...createDefaultPlayerState(PLAYER_A), rpe: 7 as const };
    expect(isKioskPlayerCompleted(state, "75")).toBe(true);
  });

  it("marks player Missing when visible duration is invalid", () => {
    const state = { ...createDefaultPlayerState(PLAYER_A), rpe: 7 as const };
    expect(isKioskPlayerCompleted(state, "0")).toBe(false);
    expect(isKioskPlayerCompleted(state, "")).toBe(false);
  });
});
