import { occurrenceMatchesSession, parseSessionKey } from "@/lib/drillAnalysis/keys";

export const HISTORY_NOTE_MAX = 2000;

const CARD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A saved card id, or one ungrouped occurrence from the same session. */
export function isHistoryNoteEntry(sessionKey: string, entryId: string): boolean {
  if (!parseSessionKey(sessionKey)) return false;
  if (!entryId || entryId.length > 800) return false;
  if (CARD_ID.test(entryId)) return true;
  if (!entryId.startsWith("ungrouped:")) return false;
  return occurrenceMatchesSession(entryId.slice("ungrouped:".length), sessionKey);
}

/** Empty text means the saved note should be removed. */
export function normalizeHistoryNote(value: unknown): { ok: true; note: string | null } | { ok: false } {
  if (typeof value !== "string") return { ok: false };
  const note = value.trim();
  if (note.length > HISTORY_NOTE_MAX) return { ok: false };
  return { ok: true, note: note.length === 0 ? null : note };
}
