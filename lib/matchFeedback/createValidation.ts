import type { MatchFeedbackCreateRequest } from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CreateMatchValidationResult =
  | { ok: true; data: MatchFeedbackCreateRequest }
  | { ok: false; error: string };

/**
 * Pure request shape validation (does not hit DB).
 * Server must still verify each player_id exists and role === 'player'.
 */
export function validateCreateMatchRequest(body: unknown): CreateMatchValidationResult {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body." };
  }

  const record = body as Record<string, unknown>;

  const opponentRaw = record.opponent;
  if (typeof opponentRaw !== "string") {
    return { ok: false, error: "Opponent is required." };
  }
  const opponent = opponentRaw.trim();
  if (!opponent) {
    return { ok: false, error: "Opponent is required." };
  }
  if (opponent.length > 120) {
    return { ok: false, error: "Opponent name is too long." };
  }

  const matchDate = record.matchDate ?? record.match_date;
  if (typeof matchDate !== "string" || !DATE_RE.test(matchDate)) {
    return { ok: false, error: "Valid match date is required (YYYY-MM-DD)." };
  }

  const matchdayRaw = record.matchday;
  const matchday =
    typeof matchdayRaw === "number"
      ? matchdayRaw
      : typeof matchdayRaw === "string" && matchdayRaw.trim() !== ""
        ? Number(matchdayRaw)
        : NaN;
  if (!Number.isInteger(matchday) || matchday < 1) {
    return { ok: false, error: "Matchday must be an integer >= 1." };
  }

  const playerIdsRaw = record.playerIds ?? record.player_ids;
  if (!Array.isArray(playerIdsRaw)) {
    return { ok: false, error: "Select at least one player." };
  }
  if (playerIdsRaw.length === 0) {
    return { ok: false, error: "Select at least one player." };
  }

  const playerIds: string[] = [];
  const seen = new Set<string>();
  for (const id of playerIdsRaw) {
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return { ok: false, error: "Invalid player ID." };
    }
    if (seen.has(id)) {
      return { ok: false, error: "Duplicate player IDs are not allowed." };
    }
    seen.add(id);
    playerIds.push(id);
  }

  return {
    ok: true,
    data: { opponent, matchDate, matchday, playerIds },
  };
}

/**
 * After loading profiles: every requested id must exist with role === 'player'.
 */
export function validateCreateMatchPlayers(
  requestedIds: string[],
  profiles: Array<{ id: string; role: string | null }>
): { ok: true } | { ok: false; error: string } {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  for (const id of requestedIds) {
    const profile = byId.get(id);
    if (!profile) {
      return { ok: false, error: "One or more players were not found." };
    }
    if (profile.role !== "player") {
      return { ok: false, error: "Only player profiles can be match participants." };
    }
  }
  if (profiles.length !== requestedIds.length) {
    // Extra profiles returned unexpectedly — still OK if all requested are valid
  }
  return { ok: true };
}
