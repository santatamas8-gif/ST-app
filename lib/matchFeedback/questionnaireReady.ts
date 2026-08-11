import {
  MATCH_FEEDBACK_SCALE_MAX,
  MATCH_FEEDBACK_SCALE_MIN,
  PRE_MATCH_OTHER_OPTION,
  type PhysicalDropoff,
  type PreMatchFeeling,
} from "./constants";

export type MatchFeedbackFormState = {
  feelings: PreMatchFeeling[];
  otherText: string;
  physicalDemand: number | null;
  performanceRating: number | null;
  dropoff: PhysicalDropoff | null;
  mentalDemand: number | null;
};

function isScaleSelected(value: number | null): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MATCH_FEEDBACK_SCALE_MIN &&
    value <= MATCH_FEEDBACK_SCALE_MAX
  );
}

/** True only when every required question has an active answer (no default scales). */
export function isMatchFeedbackFormReady(state: MatchFeedbackFormState): boolean {
  if (state.feelings.length === 0) return false;
  if (state.feelings.includes(PRE_MATCH_OTHER_OPTION) && !state.otherText.trim()) {
    return false;
  }
  if (!isScaleSelected(state.physicalDemand)) return false;
  if (!isScaleSelected(state.performanceRating)) return false;
  if (!state.dropoff) return false;
  if (!isScaleSelected(state.mentalDemand)) return false;
  return true;
}
