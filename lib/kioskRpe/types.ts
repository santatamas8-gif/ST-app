export type KioskSessionType =
  | "Pitch"
  | "Gym"
  | "Recovery"
  | "Rehab"
  | "Individual"
  | "Match"
  | "Goalkeeper"
  | "Extra";

export type KioskMatchdayTag =
  | "MD"
  | "MD+1"
  | "MD+2"
  | "MD+3"
  | "MD+4"
  | "MD-4"
  | "MD-3"
  | "MD-2"
  | "MD-1"
  | "No tag";

export type KioskGlobalSettings = {
  sessionType: KioskSessionType;
  matchdayTag: KioskMatchdayTag;
  duration: number;
};

export type KioskPlayerState = {
  playerId: string;
  sessionType: KioskSessionType;
  matchdayTag: KioskMatchdayTag;
  duration: number;
  rpe: number | null;
};

export type RpeValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
