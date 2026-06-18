import type { KioskGlobalSettings, KioskMatchdayTag, KioskSessionType } from "@/lib/kioskRpe/types";

export const SESSION_TYPES = [
  "Pitch",
  "Gym",
  "Recovery",
  "Rehab",
  "Individual",
  "Match",
  "Goalkeeper",
  "Extra",
] as const;

export const MATCHDAY_TAGS = [
  "MD",
  "MD+1",
  "MD+2",
  "MD+3",
  "MD+4",
  "MD-4",
  "MD-3",
  "MD-2",
  "MD-1",
  "No tag",
] as const;

export type SessionType = KioskSessionType;
export type MatchdayTag = KioskMatchdayTag;

export const DEFAULT_SESSION_TYPE: KioskSessionType = "Pitch";
export const DEFAULT_MATCHDAY_TAG: KioskMatchdayTag = "MD-3";
export const DEFAULT_DURATION_MINUTES = 75;

export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 300;

export const DEFAULT_GLOBAL_SETTINGS: KioskGlobalSettings = {
  sessionType: DEFAULT_SESSION_TYPE,
  matchdayTag: DEFAULT_MATCHDAY_TAG,
  duration: DEFAULT_DURATION_MINUTES,
};

/** Whole minutes only, 1–300 inclusive. Returns null when invalid or empty. */
export function parseDurationInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < MIN_DURATION_MINUTES || parsed > MAX_DURATION_MINUTES) return null;
  return parsed;
}

export function isValidDurationMinutes(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_DURATION_MINUTES &&
    value <= MAX_DURATION_MINUTES
  );
}

/** RPE 1–10 meaning labels for kiosk display. */
export function getRpeMeaning(rpe: number): string {
  switch (rpe) {
    case 1:
      return "Very easy";
    case 2:
      return "Easy";
    case 3:
      return "Light";
    case 4:
      return "Moderate";
    case 5:
      return "Hard";
    case 6:
      return "Hard+";
    case 7:
      return "Very hard";
    case 8:
      return "Very hard+";
    case 9:
      return "Extremely hard";
    default:
      return "Maximal";
  }
}

export type RpeIntensityBand = "easy" | "moderate" | "hard" | "very-hard" | "extreme" | "maximal";

export function getRpeIntensityBand(rpe: number): RpeIntensityBand {
  if (rpe <= 2) return "easy";
  if (rpe <= 4) return "moderate";
  if (rpe <= 6) return "hard";
  if (rpe <= 8) return "very-hard";
  if (rpe === 9) return "extreme";
  return "maximal";
}

/** Unselected RPE button: border + text tint by intensity band. */
export function getRpeButtonBaseClasses(rpe: number): string {
  const band = getRpeIntensityBand(rpe);
  const interactive =
    "cursor-pointer transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-400";
  switch (band) {
    case "easy":
      return `${interactive} border-emerald-600/50 text-emerald-400 bg-emerald-950/20`;
    case "moderate":
      return `${interactive} border-lime-600/50 text-lime-400 bg-lime-950/15`;
    case "hard":
      return `${interactive} border-orange-600/50 text-orange-400 bg-orange-950/15`;
    case "very-hard":
      return `${interactive} border-orange-700/60 text-orange-300 bg-orange-950/25`;
    case "extreme":
      return `${interactive} border-red-600/60 text-red-400 bg-red-950/20`;
    case "maximal":
      return `${interactive} border-red-900/70 text-red-300 bg-red-950/35`;
  }
}

/** Selected RPE button: filled background + stronger border. */
export function getRpeButtonSelectedClasses(rpe: number): string {
  const band = getRpeIntensityBand(rpe);
  const interactive =
    "cursor-pointer transition scale-105 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-400";
  switch (band) {
    case "easy":
      return `${interactive} border-emerald-400 bg-emerald-600 text-white font-bold shadow-md shadow-emerald-900/40`;
    case "moderate":
      return `${interactive} border-lime-400 bg-lime-600 text-zinc-900 font-bold shadow-md shadow-lime-900/30`;
    case "hard":
      return `${interactive} border-orange-400 bg-orange-600 text-white font-bold shadow-md shadow-orange-900/40`;
    case "very-hard":
      return `${interactive} border-orange-500 bg-orange-700 text-white font-bold shadow-md shadow-orange-900/50`;
    case "extreme":
      return `${interactive} border-red-500 bg-red-600 text-white font-bold shadow-md shadow-red-900/50`;
    case "maximal":
      return `${interactive} border-red-800 bg-red-900 text-white font-bold shadow-md shadow-red-950/60`;
  }
}

export const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
