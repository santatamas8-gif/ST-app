export type ReferenceLiftKey =
  | "squat"
  | "bench_press"
  | "deadlift"
  | "pull_up"
  | "military_press"
  | "clean"
  | "snatch"
  | "bodyweight"
  | "none";

export type LoadType = "barbell" | "dumbbell_each" | "bodyweight";

export interface StrengthProfile {
  id: string;
  player_id: string;
  bodyweight: number | null;
  squat: number | null;
  bench_press: number | null;
  deadlift: number | null;
  pull_up: number | null;
  military_press: number | null;
  clean: number | null;
  snatch: number | null;
  last_test_date: string | null;
  updated_at?: string;
}

export interface StrengthExercise {
  id: string;
  name: string;
  category: string;
  percent: number;
  related_to: string;
  percent_bw_used: number;
  equipment_used: string;
  rounding: number;
  note: string;
  video_url: string | null;
  image_url: string | null;
  active: boolean;
}

export interface SetRepScheme {
  id: string;
  name: string;
  category: string;
  description: string;
  source_excel_name: string | null;
}

export interface SetRepSchemeItem {
  id: string;
  scheme_id: string;
  week_number: number | null;
  set_number: number;
  percentage: number;
  reps: number;
}

export interface DailyStrengthSession {
  id: string;
  date: string;
  title: string;
  session_type: string;
  created_by: string | null;
  status: "draft" | "published";
  created_at?: string;
  updated_at?: string;
}

export interface SessionExerciseWithSets {
  id: string;
  session_id: string;
  exercise_id: string;
  exercise_order: number;
  exercise: StrengthExercise;
  sets: { id?: string; set_number: number; reps: number; percentage: number }[];
}

export interface PlayerCardItem {
  id: string;
  card_id: string;
  exercise_id: string | null;
  exercise_name_snapshot: string;
  exercise_image_url_snapshot: string | null;
  set_number: number;
  reps: number;
  percentage: number;
  reference_lift: string;
  reference_value: number | null;
  exercise_percent: number;
  percent_bw_used: number;
  rounding: number;
  raw_weight: number | null;
  calculated_weight: number | null;
  coach_adjusted_weight: number | null;
  display_weight: string;
  load_type: LoadType;
  note_snapshot: string;
  exercise_order?: number;
}

export interface PlayerStrengthCard {
  id: string;
  session_id: string;
  player_id: string;
  status: "draft" | "published";
  created_at?: string;
  published_at: string | null;
  session: DailyStrengthSession;
  player_name: string;
  /** From profiles.avatar_url (dashboard photo upload). */
  player_avatar_url: string | null;
  items: PlayerCardItem[];
  /** Live image URLs from strength_exercises (source of truth for display). */
  exerciseImages?: Record<string, string | null>;
}

export const SESSION_TYPES = ["Lower Body", "Upper Body", "Full Body"] as const;
