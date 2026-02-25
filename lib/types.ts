export type UserRole = "admin" | "staff" | "player";

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface DbUser {
  id: string;
  email: string;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
}

/** Per-body-part: s = soreness 1-10, p = pain 1-10 */
export type BodyPartsMap = Record<string, { s: number; p: number }>;

export interface WellnessRow {
  id: string;
  user_id: string;
  date: string;
  bed_time: string | null;
  wake_time: string | null;
  sleep_duration: number | null;
  sleep_quality: number | null;
  soreness: number | null;
  fatigue: number | null;
  stress: number | null;
  mood: number | null;
  motivation: number | null;
  illness: boolean | null;
  bodyweight: number | null;
  body_parts: BodyPartsMap | null;
  created_at?: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  date: string;
  duration: number;
  rpe: number | null;
  load: number | null;
  created_at?: string;
}

export interface WellnessFormInput {
  date: string;
  bed_time: string;
  wake_time: string;
  sleep_quality: number;
  soreness: number;
  fatigue: number;
  stress: number;
  mood: number;
  bodyweight?: number;
}

export interface SessionFormInput {
  date: string;
  duration: number;
  rpe: number;
}

export type AvailabilityStatus = "available" | "injured" | "unavailable";

export interface AvailabilityRow {
  id: string;
  user_id: string;
  date: string;
  status: AvailabilityStatus;
  created_at?: string;
}

export type ScheduleActivityType =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "training"
  | "gym"
  | "recovery"
  | "pre_activation"
  | "video_analysis"
  | "meeting"
  | "traveling"
  | "physio"
  | "medical"
  | "media"
  | "rest_off"
  | "match"
  | "team_building"
  | "individual";

export interface ScheduleRow {
  id: string;
  date: string;
  activity_type: ScheduleActivityType;
  sort_order?: number;
  created_at?: string;
  notes?: string | null;
}
