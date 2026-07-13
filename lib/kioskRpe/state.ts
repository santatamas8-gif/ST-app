import {
  DEFAULT_DURATION_MINUTES,
  DEFAULT_MATCHDAY_TAG,
  DEFAULT_SESSION_TYPE,
  parseDurationInput,
} from "@/lib/kioskRpe/constants";
import { isExistingSubmissionLocked } from "@/lib/kioskRpe/existingSubmission";
import type { KioskGlobalSettings, KioskPlayerState, RpeValue } from "@/lib/kioskRpe/types";

export function createDefaultPlayerState(playerId: string): KioskPlayerState {
  return {
    playerId,
    sessionType: DEFAULT_SESSION_TYPE,
    matchdayTag: DEFAULT_MATCHDAY_TAG,
    duration: DEFAULT_DURATION_MINUTES,
    rpe: null,
  };
}

export function createInitialPlayerStates(
  players: { id: string }[],
  existing?: Record<string, KioskPlayerState>
): Record<string, KioskPlayerState> {
  const next: Record<string, KioskPlayerState> = {};
  for (const player of players) {
    const prev = existing?.[player.id];
    if (prev) {
      next[player.id] = { ...prev, playerId: player.id };
    } else {
      next[player.id] = createDefaultPlayerState(player.id);
    }
  }
  return next;
}

export function applySettingsToAll(
  playerStates: Record<string, KioskPlayerState>,
  globalSettings: KioskGlobalSettings
): Record<string, KioskPlayerState> {
  const next: Record<string, KioskPlayerState> = {};
  for (const [id, state] of Object.entries(playerStates)) {
    next[id] = {
      ...state,
      sessionType: globalSettings.sessionType,
      matchdayTag: globalSettings.matchdayTag,
      duration: globalSettings.duration,
    };
  }
  return next;
}

export type KioskPlayerSettingsPatch = Partial<
  Pick<KioskPlayerState, "sessionType" | "matchdayTag" | "duration">
>;

export function updatePlayerSettings(
  playerStates: Record<string, KioskPlayerState>,
  playerId: string,
  patch: KioskPlayerSettingsPatch
): Record<string, KioskPlayerState> {
  const current = playerStates[playerId];
  if (!current) return playerStates;
  return {
    ...playerStates,
    [playerId]: { ...current, ...patch },
  };
}

export function updatePlayerRpe(
  playerStates: Record<string, KioskPlayerState>,
  playerId: string,
  rpe: RpeValue | null
): Record<string, KioskPlayerState> {
  const current = playerStates[playerId];
  if (!current) return playerStates;
  if (isExistingSubmissionLocked(current)) return playerStates;
  return {
    ...playerStates,
    [playerId]: { ...current, rpe },
  };
}

/** Completed when RPE is set and the visible duration draft is valid (1–300 whole minutes). */
export function isKioskPlayerCompleted(
  state: KioskPlayerState,
  durationInput: string
): boolean {
  if (state.rpe === null || state.rpe < 1 || state.rpe > 10) return false;
  return parseDurationInput(durationInput) !== null;
}

export function createInitialDurationInputs(
  players: { id: string }[],
  existing?: Record<string, string>,
  fallbackDuration = DEFAULT_DURATION_MINUTES
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const player of players) {
    next[player.id] = existing?.[player.id] ?? String(fallbackDuration);
  }
  return next;
}

export function syncAllDurationInputs(
  playerIds: string[],
  duration: number,
  existing?: Record<string, string>
): Record<string, string> {
  const next = { ...(existing ?? {}) };
  const value = String(duration);
  for (const id of playerIds) {
    next[id] = value;
  }
  return next;
}
