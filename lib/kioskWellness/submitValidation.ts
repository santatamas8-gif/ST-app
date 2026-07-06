import { getTeamSessionDateString } from "@/lib/kioskRpe/localDate";

export type KioskWellnessBodyParts = Record<string, { s: number; p: number }>;

export type KioskWellnessSubmitEntry = {
  playerId: string;
  initials: string;
  sleep_quality: number;
  fatigue: number;
  soreness: number;
  stress: number;
  mood: number;
  illness?: boolean;
  bed_time?: string;
  wake_time?: string;
  body_parts?: KioskWellnessBodyParts;
};

export type KioskWellnessSubmitRequest = {
  date: string;
  entry: KioskWellnessSubmitEntry;
};

type ValidationResult =
  | { ok: true; data: KioskWellnessSubmitRequest }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isScale(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10;
}

function parseBodyParts(value: unknown): KioskWellnessBodyParts | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) return undefined;

  const result: KioskWellnessBodyParts = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) continue;
    const soreness = (raw as { s?: unknown }).s;
    const pain = (raw as { p?: unknown }).p;
    if (
      typeof soreness !== "number" ||
      typeof pain !== "number" ||
      !Number.isFinite(soreness) ||
      !Number.isFinite(pain)
    ) {
      continue;
    }
    result[key] = { s: soreness, p: pain };
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function validateKioskWellnessSubmitRequest(body: unknown): ValidationResult {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body." };
  }

  const record = body as Record<string, unknown>;
  const date =
    typeof record.date === "string" && DATE_RE.test(record.date)
      ? record.date
      : getTeamSessionDateString();

  const entryRaw = record.entry;
  if (entryRaw === null || typeof entryRaw !== "object" || Array.isArray(entryRaw)) {
    return { ok: false, error: "Missing wellness entry." };
  }

  const entry = entryRaw as Record<string, unknown>;
  const playerId = entry.playerId;
  if (typeof playerId !== "string" || !UUID_RE.test(playerId)) {
    return { ok: false, error: "Invalid player ID." };
  }

  const initials = entry.initials;
  if (typeof initials !== "string" || initials.trim().length < 2) {
    return { ok: false, error: "Player initials are required." };
  }

  if (
    !isScale(entry.sleep_quality) ||
    !isScale(entry.fatigue) ||
    !isScale(entry.soreness) ||
    !isScale(entry.stress) ||
    !isScale(entry.mood)
  ) {
    return { ok: false, error: "All wellness scales must be integers from 1 to 10." };
  }

  const bedTime = entry.bed_time;
  const wakeTime = entry.wake_time;
  if (typeof bedTime !== "string" || !TIME_RE.test(bedTime)) {
    return { ok: false, error: "Bed time is required (HH:MM)." };
  }
  if (typeof wakeTime !== "string" || !TIME_RE.test(wakeTime)) {
    return { ok: false, error: "Wake time is required (HH:MM)." };
  }

  const illness = entry.illness;
  if (illness !== undefined && typeof illness !== "boolean") {
    return { ok: false, error: "Invalid illness value." };
  }

  const bodyParts = parseBodyParts(entry.body_parts);
  if (entry.body_parts !== undefined && bodyParts === undefined) {
    return { ok: false, error: "Invalid body map data." };
  }

  return {
    ok: true,
    data: {
      date,
      entry: {
        playerId,
        initials: initials.trim(),
        sleep_quality: entry.sleep_quality,
        fatigue: entry.fatigue,
        soreness: entry.soreness,
        stress: entry.stress,
        mood: entry.mood,
        illness: illness ?? false,
        bed_time: bedTime,
        wake_time: wakeTime,
        body_parts: bodyParts,
      },
    },
  };
}
