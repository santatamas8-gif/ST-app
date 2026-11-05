import type { SessionRef } from "@/lib/drillAnalysis/types";

const VERSION = "da1";

function encodePart(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodePart(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export function buildSessionKey(session: SessionRef): string {
  return [
    VERSION,
    "s",
    encodePart(session.date),
    encodePart(session.weekId),
    encodePart(session.mdTag),
    encodePart(session.sessionType),
  ].join(".");
}

export function buildOccurrenceKey(
  session: SessionRef,
  drill: string,
  startToken: string
): string {
  return [
    VERSION,
    "o",
    encodePart(session.date),
    encodePart(session.weekId),
    encodePart(session.mdTag),
    encodePart(session.sessionType),
    encodePart(drill),
    encodePart(startToken),
  ].join(".");
}

export function sessionLabel(session: SessionRef): string {
  return `${session.weekId} · ${session.mdTag} · ${session.sessionType}`;
}

function partsOf(key: string): string[] | null {
  const parts = key.split(".");
  if (parts.length < 2 || parts[0] !== VERSION) return null;
  return parts;
}

export function parseSessionKey(key: string): SessionRef | null {
  const parts = partsOf(key);
  if (!parts || parts.length !== 6 || parts[1] !== "s") return null;
  const date = decodePart(parts[2]);
  const weekId = decodePart(parts[3]);
  const mdTag = decodePart(parts[4]);
  const sessionType = decodePart(parts[5]);
  if (date === null || weekId === null || mdTag === null || sessionType === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { date, weekId, mdTag, sessionType };
}

export function occurrenceMatchesSession(occurrenceKey: string, sessionKeyValue: string): boolean {
  const occurrence = partsOf(occurrenceKey);
  const session = partsOf(sessionKeyValue);
  if (!occurrence || !session) return false;
  if (occurrence.length !== 8 || occurrence[1] !== "o") return false;
  if (session.length !== 6 || session[1] !== "s") return false;
  return (
    occurrence[2] === session[2] &&
    occurrence[3] === session[3] &&
    occurrence[4] === session[4] &&
    occurrence[5] === session[5]
  );
}

/** Excel-serial Power BI datetimes arrive as `1899-12-30THH:mm:ss`. */
export function parseDrillStart(value: unknown): {
  token: string;
  label: string;
  parsed: boolean;
} {
  if (value === null || value === undefined || value === "") {
    return { token: "blank", label: "No start time", parsed: false };
  }
  const text = typeof value === "string" ? value.trim() : String(value).trim();
  if (!text) return { token: "blank", label: "No start time", parsed: false };
  const clock = /T(\d{2}:\d{2}:\d{2})/.exec(text) ?? /^(\d{2}:\d{2}:\d{2})/.exec(text);
  if (clock) return { token: clock[1], label: clock[1], parsed: true };
  return { token: `raw:${text}`, label: "Unrecognized start time", parsed: false };
}
