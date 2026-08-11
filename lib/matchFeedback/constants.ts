/** Approved Q1 multi-select options (stored exactly as labeled). */
export const PRE_MATCH_FEELINGS = [
  "Prepared",
  "Fresh",
  "Slight muscle soreness",
  "Heavy legs",
  "Tired",
  "Stressed",
  "Muscle tightness",
  "Pain / discomfort",
  "Low energy",
  "Not fully recovered",
  "Other",
] as const;

export type PreMatchFeeling = (typeof PRE_MATCH_FEELINGS)[number];

export const PRE_MATCH_OTHER_OPTION: PreMatchFeeling = "Other";
export const PRE_MATCH_OTHER_MAX_LENGTH = 200;

export const PHYSICAL_DEMAND_LABELS: Record<number, string> = {
  1: "Very easy",
  2: "Easy",
  3: "Quite easy",
  4: "Slightly hard",
  5: "Moderate",
  6: "Quite hard",
  7: "Hard",
  8: "Very hard",
  9: "Extremely hard",
  10: "Maximum effort",
};

export const PERFORMANCE_RATING_LABELS: Record<number, string> = {
  1: "Very poor",
  2: "Poor",
  3: "Below average",
  4: "Slightly below average",
  5: "Average",
  6: "Slightly above average",
  7: "Good",
  8: "Very good",
  9: "Excellent",
  10: "Best possible performance",
};

export const PHYSICAL_DROPOFF_OPTIONS = [
  "No drop-off",
  "First half",
  "45–60 min",
  "60–75 min",
  "75–90+ min",
] as const;

export type PhysicalDropoff = (typeof PHYSICAL_DROPOFF_OPTIONS)[number];

export const MENTAL_DEMAND_LABELS: Record<number, string> = {
  1: "Very easy",
  2: "Easy",
  3: "Quite easy",
  4: "Slightly demanding",
  5: "Moderate",
  6: "Quite demanding",
  7: "Demanding",
  8: "Very demanding",
  9: "Extremely demanding",
  10: "Maximum mental demand",
};

export const MATCH_FEEDBACK_SCALE_MIN = 1;
export const MATCH_FEEDBACK_SCALE_MAX = 10;
