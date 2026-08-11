import {
  MATCH_FEEDBACK_SCALE_MAX,
  MATCH_FEEDBACK_SCALE_MIN,
  PHYSICAL_DROPOFF_OPTIONS,
  PRE_MATCH_FEELINGS,
  PRE_MATCH_OTHER_MAX_LENGTH,
  PRE_MATCH_OTHER_OPTION,
  type PhysicalDropoff,
  type PreMatchFeeling,
} from "./constants";
import type { MatchFeedbackSubmitRequest } from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FEELING_SET = new Set<string>(PRE_MATCH_FEELINGS);
const DROPOFF_SET = new Set<string>(PHYSICAL_DROPOFF_OPTIONS);

export type SubmitMatchValidationResult =
  | { ok: true; data: MatchFeedbackSubmitRequest }
  | { ok: false; error: string };

function isScale(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MATCH_FEEDBACK_SCALE_MIN &&
    value <= MATCH_FEEDBACK_SCALE_MAX
  );
}

function parseFeelings(value: unknown): PreMatchFeeling[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const out: PreMatchFeeling[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || !FEELING_SET.has(item)) return null;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item as PreMatchFeeling);
  }
  return out.length > 0 ? out : null;
}

/**
 * Normalize Other text:
 * - Other not selected → null
 * - Other selected → trimmed non-empty string ≤ max length
 */
export function normalizePreMatchOtherText(
  feelings: PreMatchFeeling[],
  otherText: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  const wantsOther = feelings.includes(PRE_MATCH_OTHER_OPTION);
  if (!wantsOther) {
    return { ok: true, value: null };
  }
  if (typeof otherText !== "string") {
    return { ok: false, error: "Please specify Other." };
  }
  const trimmed = otherText.trim();
  if (!trimmed) {
    return { ok: false, error: "Please specify Other." };
  }
  if (trimmed.length > PRE_MATCH_OTHER_MAX_LENGTH) {
    return {
      ok: false,
      error: `Other text must be at most ${PRE_MATCH_OTHER_MAX_LENGTH} characters.`,
    };
  }
  return { ok: true, value: trimmed };
}

export function validateSubmitMatchFeedbackRequest(body: unknown): SubmitMatchValidationResult {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body." };
  }

  const record = body as Record<string, unknown>;

  const matchId = record.matchId ?? record.match_id;
  if (typeof matchId !== "string" || !UUID_RE.test(matchId)) {
    return { ok: false, error: "Invalid match ID." };
  }

  const playerId = record.playerId ?? record.player_id;
  if (typeof playerId !== "string" || !UUID_RE.test(playerId)) {
    return { ok: false, error: "Invalid player ID." };
  }

  const feelings = parseFeelings(record.preMatchFeelings ?? record.pre_match_feelings);
  if (!feelings) {
    return { ok: false, error: "Select at least one pre-match feeling." };
  }

  const otherNorm = normalizePreMatchOtherText(
    feelings,
    record.preMatchOtherText ?? record.pre_match_other_text ?? null
  );
  if (!otherNorm.ok) return otherNorm;

  const physicalDemand = record.physicalDemand ?? record.physical_demand;
  if (!isScale(physicalDemand)) {
    return { ok: false, error: "Physical demand must be an integer from 1 to 10." };
  }

  const performanceRating = record.performanceRating ?? record.performance_rating;
  if (!isScale(performanceRating)) {
    return { ok: false, error: "Performance rating must be an integer from 1 to 10." };
  }

  const dropoffRaw = record.physicalDropoff ?? record.physical_dropoff;
  if (typeof dropoffRaw !== "string" || !DROPOFF_SET.has(dropoffRaw)) {
    return { ok: false, error: "Select a valid physical drop-off option." };
  }

  const mentalDemand = record.mentalDemand ?? record.mental_demand;
  if (!isScale(mentalDemand)) {
    return { ok: false, error: "Mental demand must be an integer from 1 to 10." };
  }

  return {
    ok: true,
    data: {
      matchId,
      playerId,
      preMatchFeelings: feelings,
      preMatchOtherText: otherNorm.value,
      physicalDemand,
      performanceRating,
      physicalDropoff: dropoffRaw as PhysicalDropoff,
      mentalDemand,
    },
  };
}
