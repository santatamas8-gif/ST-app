import { parseDurationInput } from "@/lib/kioskRpe/constants";
import { isKioskPlayerCompleted } from "@/lib/kioskRpe/state";
import type { KioskRpeSubmitEntry, KioskRpeSubmitRequest } from "@/lib/kioskRpe/submitValidation";
import type { KioskPlayerState } from "@/lib/kioskRpe/types";
import { getLocalDateString } from "@/lib/kioskRpe/localDate";

export function matchdayTagToApi(
  tag: KioskPlayerState["matchdayTag"]
): KioskRpeSubmitEntry["matchdayTag"] {
  return tag === "No tag" ? null : tag;
}

export function buildCompletedSubmitEntries(
  playerIds: string[],
  playerStates: Record<string, KioskPlayerState>,
  durationInputs: Record<string, string>
): KioskRpeSubmitEntry[] {
  const entries: KioskRpeSubmitEntry[] = [];

  for (const playerId of playerIds) {
    const state = playerStates[playerId];
    const durationInput = durationInputs[playerId] ?? "";
    if (!state || !isKioskPlayerCompleted(state, durationInput)) continue;

    const durationMinutes = parseDurationInput(durationInput);
    if (durationMinutes === null || state.rpe === null) continue;

    entries.push({
      playerId,
      rpe: state.rpe,
      durationMinutes,
      sessionType: state.sessionType,
      matchdayTag: matchdayTagToApi(state.matchdayTag),
      ...(state.source === "existingSubmission" && state.existingSessionId
        ? { existingSessionId: state.existingSessionId }
        : {}),
    });
  }

  return entries;
}

export function buildKioskSubmitRequest(
  playerIds: string[],
  playerStates: Record<string, KioskPlayerState>,
  durationInputs: Record<string, string>
): KioskRpeSubmitRequest {
  return {
    date: getLocalDateString(),
    entries: buildCompletedSubmitEntries(playerIds, playerStates, durationInputs),
  };
}
