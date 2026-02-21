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
  bodyweight: number | null;
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
