import "server-only";

import { executePowerBiDaxQuery } from "@/lib/powerbi/client.server";
import { logPowerBiError } from "@/lib/powerbi/errors";
import { firstResultRows, pickRowValue } from "@/lib/powerbi/queries/rowUtils";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDrillAnalysisModel } from "@/lib/drillAnalysis/assemble";
import { buildSessionKey, parseSessionKey, sessionLabel } from "@/lib/drillAnalysis/keys";
import { buildOccurrences, parseDrillSourceRow, parsePowerBiDate } from "@/lib/drillAnalysis/metrics";
import { keptDrillAnalysisRequest } from "@/lib/drillAnalysis/pageSelection";
import { buildDrillSessionListDax, buildDrillSessionRowsDax } from "@/lib/drillAnalysis/query";
import {
  DRILL_ANALYSIS_SCOPE,
  type DrillAnalysisPageData,
  type SavedDrillCard,
  type SessionListItem,
  type SessionRef,
} from "@/lib/drillAnalysis/types";

export type { DrillAnalysisPageData };

function textValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function asSetRows(value: unknown): { occurrence_key: string; sort_index: number }[] {
  if (Array.isArray(value)) return value as { occurrence_key: string; sort_index: number }[];
  if (value && typeof value === "object") return [value as { occurrence_key: string; sort_index: number }];
  return [];
}

export async function loadSavedCards(sessionKey: string): Promise<
  | { ok: true; cards: SavedDrillCard[] }
  | { ok: false; error: string }
> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("drill_analysis_cards")
      .select("id, display_name, sort_index, image_path, drill_analysis_card_sets(occurrence_key, sort_index)")
      .eq("scope_key", DRILL_ANALYSIS_SCOPE)
      .eq("session_key", sessionKey)
      .order("sort_index", { ascending: true });
    if (error) {
      return {
        ok: false,
        error: "Saved drill layout is unavailable. Apply the Drill Analysis migration before saving.",
      };
    }
    const cards: SavedDrillCard[] = (data ?? []).map((row) => {
      const ordered = asSetRows(row.drill_analysis_card_sets).sort(
        (a, b) => Number(a.sort_index) - Number(b.sort_index)
      );
      return {
        id: String(row.id),
        displayName: String(row.display_name),
        sortIndex: Number(row.sort_index),
        imagePath: row.image_path ? String(row.image_path) : null,
        occurrenceKeys: ordered.map((set) => String(set.occurrence_key)),
      };
    });
    return { ok: true, cards };
  } catch {
    return {
      ok: false,
      error: "Saved drill layout is unavailable. Apply the Drill Analysis migration before saving.",
    };
  }
}

export async function loadDrillAnalysisPage(input: {
  date?: string;
  sessionKey?: string;
  player?: string;
}): Promise<DrillAnalysisPageData> {
  const empty: DrillAnalysisPageData = {
    dates: [],
    sessions: [],
    selectedDate: null,
    selectedSessionKey: null,
    selectedPlayer: null,
    model: null,
    sourceError: null,
    layoutError: null,
    playerError: null,
  };

  const listResult = await executePowerBiDaxQuery(buildDrillSessionListDax());
  if (!listResult.ok) {
    logPowerBiError("drillAnalysis.sessions", listResult.error);
    const kept = keptDrillAnalysisRequest(input);
    return { ...empty, ...kept, sourceError: "Drill data could not be loaded from Power BI." };
  }

  const sessions: SessionListItem[] = [];
  for (const row of firstResultRows(listResult.results)) {
    const date = parsePowerBiDate(pickRowValue(row, "Date"));
    const weekId = textValue(pickRowValue(row, "Week ID")).trim();
    const mdTag = textValue(pickRowValue(row, "MD_Tag")).trim();
    const sessionType = textValue(pickRowValue(row, "SessionType")).trim();
    if (!date || !weekId || !mdTag || !sessionType) continue;
    const session: SessionRef = { date, weekId, mdTag, sessionType };
    sessions.push({
      key: buildSessionKey(session),
      date,
      label: sessionLabel(session),
      weekId,
      mdTag,
      sessionType,
    });
  }
  sessions.sort((a, b) => (a.date === b.date ? (a.label < b.label ? -1 : 1) : a.date < b.date ? 1 : -1));
  const dates = [...new Set(sessions.map((session) => session.date))];
  if (sessions.length === 0) {
    const kept = keptDrillAnalysisRequest(input);
    return { ...empty, ...kept, sourceError: "Power BI returned no drill sessions." };
  }

  const selectedDate = input.date && dates.includes(input.date) ? input.date : dates[0];
  const sessionsOnDate = sessions.filter((session) => session.date === selectedDate);
  const selected =
    sessionsOnDate.find((session) => session.key === input.sessionKey) ?? sessionsOnDate[0];
  const session: SessionRef = {
    date: selected.date,
    weekId: selected.weekId,
    mdTag: selected.mdTag,
    sessionType: selected.sessionType,
  };
  const dax = buildDrillSessionRowsDax(session);
  if (!dax) {
    return { ...empty, dates, sessions, selectedDate, sourceError: "The selected session date is not valid." };
  }

  const rowsResult = await executePowerBiDaxQuery(dax);
  if (!rowsResult.ok) {
    logPowerBiError("drillAnalysis.rows", rowsResult.error);
    return {
      ...empty,
      dates,
      sessions,
      selectedDate,
      selectedSessionKey: selected.key,
      sourceError: "Drill rows for this session could not be loaded from Power BI.",
    };
  }

  const parsed = firstResultRows(rowsResult.results).map((row) => parseDrillSourceRow(row));
  const built = buildOccurrences(session, parsed);
  const requestedPlayer = input.player?.trim() ? input.player : null;
  const playerNames = new Set(built.occurrences.flatMap((occurrence) => occurrence.players.map((player) => player.player)));
  if (requestedPlayer && !playerNames.has(requestedPlayer)) {
    return {
      ...empty,
      dates,
      sessions,
      selectedDate,
      selectedSessionKey: selected.key,
      selectedPlayer: requestedPlayer,
      playerError: "This player has no rows in the selected session. Team average was not substituted.",
    };
  }

  const saved = await loadSavedCards(selected.key);
  const model = buildDrillAnalysisModel({
    session,
    occurrences: built.occurrences,
    savedCards: saved.ok ? saved.cards : [],
    player: requestedPlayer,
    excludedBlankDrillRows: built.excludedBlankDrillRows,
    excludedBlankPlayerRows: built.excludedBlankPlayerRows,
  });

  return {
    dates,
    sessions,
    selectedDate,
    selectedSessionKey: selected.key,
    selectedPlayer: requestedPlayer,
    model,
    sourceError: null,
    layoutError: saved.ok ? null : saved.error,
    playerError: null,
  };
}

export function sessionFromKey(sessionKey: string): SessionRef | null {
  return parseSessionKey(sessionKey);
}
