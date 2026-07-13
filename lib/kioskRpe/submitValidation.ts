import {
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  SESSION_TYPES,
} from "@/lib/kioskRpe/constants";
import type { KioskSessionType } from "@/lib/kioskRpe/types";

export const KIOSK_SUBMIT_MAX_ENTRIES = 100;

/** Matchday values stored in the database (null = no tag). */
export const KIOSK_MATCHDAY_DB_VALUES = [
  "MD",
  "MD+1",
  "MD+2",
  "MD+3",
  "MD+4",
  "MD-4",
  "MD-3",
  "MD-2",
  "MD-1",
] as const;

export type KioskMatchdayDbValue = (typeof KIOSK_MATCHDAY_DB_VALUES)[number];

export type KioskRpeSubmitEntry = {
  playerId: string;
  rpe: number;
  durationMinutes: number;
  sessionType: KioskSessionType;
  matchdayTag: KioskMatchdayDbValue | null;
  existingSessionId?: string;
};

export type KioskRpeSubmitRequest = {
  date: string;
  entries: KioskRpeSubmitEntry[];
};

const SESSION_TYPE_SET = new Set<string>(SESSION_TYPES);
const MATCHDAY_DB_SET = new Set<string>(KIOSK_MATCHDAY_DB_VALUES);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Validates YYYY-MM-DD as a real calendar date. */
export function isValidIsoDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isValidPlayerId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) return null;
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return null;
    return parsed;
  }
  return null;
}

function parseMatchdayTag(value: unknown): KioskMatchdayDbValue | null | "invalid" {
  if (value === null || value === undefined) return null;
  if (value === "No tag") return "invalid";
  if (typeof value !== "string") return "invalid";
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "No tag") return "invalid";
  if (!MATCHDAY_DB_SET.has(trimmed)) return "invalid";
  return trimmed as KioskMatchdayDbValue;
}

export function validateKioskRpeSubmitRequest(
  body: unknown
): { ok: true; data: KioskRpeSubmitRequest } | { ok: false; error: string } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body." };
  }

  const record = body as Record<string, unknown>;
  const date = typeof record.date === "string" ? record.date.trim() : "";
  if (!date || !isValidIsoDateString(date)) {
    return { ok: false, error: "date must be a valid YYYY-MM-DD value." };
  }

  if (!Array.isArray(record.entries)) {
    return { ok: false, error: "entries must be a non-empty array." };
  }

  const rawEntries = record.entries;
  if (rawEntries.length === 0) {
    return { ok: false, error: "entries must contain at least one player." };
  }
  if (rawEntries.length > KIOSK_SUBMIT_MAX_ENTRIES) {
    return {
      ok: false,
      error: `entries must not exceed ${KIOSK_SUBMIT_MAX_ENTRIES} players per request.`,
    };
  }

  const seenPlayerIds = new Set<string>();
  const entries: KioskRpeSubmitEntry[] = [];

  for (let i = 0; i < rawEntries.length; i++) {
    const item = rawEntries[i];
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: `entries[${i}] is invalid.` };
    }

    const row = item as Record<string, unknown>;
    const playerIdRaw =
      typeof row.playerId === "string"
        ? row.playerId
        : typeof row.player_id === "string"
          ? row.player_id
          : "";

    if (!isValidPlayerId(playerIdRaw)) {
      return { ok: false, error: `entries[${i}].playerId is invalid.` };
    }
    const playerId = playerIdRaw.trim();

    if (seenPlayerIds.has(playerId)) {
      return { ok: false, error: "Duplicate player IDs are not allowed in one request." };
    }
    seenPlayerIds.add(playerId);

    const rpe = parsePositiveInteger(row.rpe);
    if (rpe === null || rpe < 1 || rpe > 10) {
      return { ok: false, error: `entries[${i}].rpe must be a whole number from 1 to 10.` };
    }

    const durationMinutes = parsePositiveInteger(
      row.durationMinutes ?? row.duration_minutes ?? row.duration
    );
    if (
      durationMinutes === null ||
      durationMinutes < MIN_DURATION_MINUTES ||
      durationMinutes > MAX_DURATION_MINUTES
    ) {
      return {
        ok: false,
        error: `entries[${i}].durationMinutes must be a whole number from ${MIN_DURATION_MINUTES} to ${MAX_DURATION_MINUTES}.`,
      };
    }

    const sessionTypeRaw = row.sessionType ?? row.session_type;
    if (typeof sessionTypeRaw !== "string" || !SESSION_TYPE_SET.has(sessionTypeRaw)) {
      return { ok: false, error: `entries[${i}].sessionType is invalid.` };
    }

    const matchdayParsed = parseMatchdayTag(row.matchdayTag ?? row.matchday_tag);
    if (matchdayParsed === "invalid") {
      return {
        ok: false,
        error: `entries[${i}].matchdayTag is invalid. Use null for no tag.`,
      };
    }

    const existingSessionIdRaw = row.existingSessionId ?? row.existing_session_id;
    let existingSessionId: string | undefined;
    if (existingSessionIdRaw !== undefined) {
      if (!isValidPlayerId(existingSessionIdRaw)) {
        return { ok: false, error: `entries[${i}].existingSessionId is invalid.` };
      }
      existingSessionId = existingSessionIdRaw.trim();
    }

    entries.push({
      playerId,
      rpe,
      durationMinutes,
      sessionType: sessionTypeRaw as KioskSessionType,
      matchdayTag: matchdayParsed,
      ...(existingSessionId ? { existingSessionId } : {}),
    });
  }

  return { ok: true, data: { date, entries } };
}
