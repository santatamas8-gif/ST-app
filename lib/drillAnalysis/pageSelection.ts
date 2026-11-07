import { parseSessionKey, sessionLabel } from "@/lib/drillAnalysis/keys";
import type { SessionListItem } from "@/lib/drillAnalysis/types";

/** Keep the requested date, session, and player when a load fails. */
export function keptDrillAnalysisRequest(input: {
  date?: string;
  sessionKey?: string;
  player?: string;
}): {
  dates: string[];
  sessions: SessionListItem[];
  selectedDate: string | null;
  selectedSessionKey: string | null;
  selectedPlayer: string | null;
} {
  const parsed = input.sessionKey ? parseSessionKey(input.sessionKey) : null;
  const requestedDate = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null;
  const selectedDate = requestedDate ?? parsed?.date ?? null;
  const session = parsed && (!selectedDate || parsed.date === selectedDate) ? parsed : null;
  const selectedSessionKey = session && input.sessionKey ? input.sessionKey : null;
  const sessions: SessionListItem[] = session && selectedSessionKey
    ? [
        {
          key: selectedSessionKey,
          date: session.date,
          label: sessionLabel(session),
          weekId: session.weekId,
          mdTag: session.mdTag,
          sessionType: session.sessionType,
        },
      ]
    : [];
  return {
    dates: selectedDate ? [selectedDate] : [],
    sessions,
    selectedDate,
    selectedSessionKey,
    selectedPlayer: input.player?.trim() ? input.player.trim() : null,
  };
}
