import "server-only";

import { executePowerBiDaxQuery } from "@/lib/powerbi/client.server";
import { logPowerBiError } from "@/lib/powerbi/errors";
import { firstResultRows, pickRowValue } from "@/lib/powerbi/queries/rowUtils";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDrillAnalysisModel } from "@/lib/drillAnalysis/assemble";
import { buildHistoryCards, historyDetailFromModel, type HistoryDetail, type HistoryEntry } from "@/lib/drillAnalysis/history";
import { loadHistoryNote } from "@/lib/drillAnalysis/historyNote.server";
import { buildSessionKey, parseSessionKey } from "@/lib/drillAnalysis/keys";
import { loadSavedCards } from "@/lib/drillAnalysis/load.server";
import { buildOccurrences, parseDrillSourceRow, parsePowerBiDate } from "@/lib/drillAnalysis/metrics";
import { buildDrillHistoryIdentityDax, buildDrillSessionRowsDax } from "@/lib/drillAnalysis/query";
import { DRILL_ANALYSIS_SCOPE, type SavedDrillCard, type SessionRef } from "@/lib/drillAnalysis/types";

export type DrillHistoryCatalog = {
  entries: HistoryEntry[];
  layoutNote: string | null;
};

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

/** Read every saved card. Does not create or update rows. */
async function loadSavedCardsBySession(): Promise<
  { ok: true; bySession: Map<string, SavedDrillCard[]> } | { ok: false }
> {
  try {
    const admin = createAdminClient();
    const bySession = new Map<string, SavedDrillCard[]>();
    const pageSize = 1000;
    let from = 0;
    for (;;) {
      const { data, error } = await admin
        .from("drill_analysis_cards")
        .select("id, session_key, display_name, sort_index, image_path, drill_analysis_card_sets(occurrence_key, sort_index)")
        .eq("scope_key", DRILL_ANALYSIS_SCOPE)
        .order("sort_index", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) return { ok: false };
      const rows = data ?? [];
      for (const row of rows) {
        const sessionKey = String(row.session_key ?? "");
        if (!sessionKey) continue;
        const ordered = asSetRows(row.drill_analysis_card_sets).sort(
          (left, right) => Number(left.sort_index) - Number(right.sort_index)
        );
        const card: SavedDrillCard = {
          id: String(row.id),
          displayName: String(row.display_name ?? ""),
          sortIndex: Number(row.sort_index),
          imagePath: row.image_path ? String(row.image_path) : null,
          occurrenceKeys: ordered.map((set) => String(set.occurrence_key)),
        };
        const list = bySession.get(sessionKey);
        if (list) list.push(card);
        else bySession.set(sessionKey, [card]);
      }
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    return { ok: true, bySession };
  } catch {
    return { ok: false };
  }
}

export async function loadDrillHistoryCatalog(): Promise<
  { ok: true; catalog: DrillHistoryCatalog } | { ok: false; error: string }
> {
  const result = await executePowerBiDaxQuery(buildDrillHistoryIdentityDax());
  if (!result.ok) {
    logPowerBiError("drillAnalysis.history", result.error);
    return { ok: false, error: "Drill history could not be loaded." };
  }

  const buckets = new Map<string, { session: SessionRef; rows: ReturnType<typeof parseDrillSourceRow>[] }>();
  for (const raw of firstResultRows(result.results)) {
    const date = parsePowerBiDate(pickRowValue(raw, "Date"));
    const weekId = textValue(pickRowValue(raw, "Week ID")).trim();
    const mdTag = textValue(pickRowValue(raw, "MD_Tag")).trim();
    const sessionType = textValue(pickRowValue(raw, "SessionType")).trim();
    if (!date || !weekId || !mdTag || !sessionType) continue;
    const session: SessionRef = { date, weekId, mdTag, sessionType };
    const sessionKey = buildSessionKey(session);
    const parsed = parseDrillSourceRow({
      ...raw,
      Player: pickRowValue(raw, "Player"),
      Drill: pickRowValue(raw, "Drill"),
      DrillStart: pickRowValue(raw, "Drill Start Time"),
    });
    const bucket = buckets.get(sessionKey);
    if (bucket) bucket.rows.push(parsed);
    else buckets.set(sessionKey, { session, rows: [parsed] });
  }

  const saved = await loadSavedCardsBySession();
  const entries = buildHistoryCards(
    [...buckets.entries()].map(([sessionKey, bucket]) => {
      const built = buildOccurrences(bucket.session, bucket.rows);
      return {
        session: bucket.session,
        sessionKey,
        occurrences: built.occurrences,
        savedCards: saved.ok ? (saved.bySession.get(sessionKey) ?? []) : [],
      };
    })
  );

  return {
    ok: true,
    catalog: {
      entries,
      layoutNote: saved.ok
        ? null
        : "Saved groupings could not be loaded. Each drill is shown separately.",
    },
  };
}

export async function loadHistorySessionModel(sessionKey: string, cardId: string): Promise<
  | { ok: true; model: ReturnType<typeof buildDrillAnalysisModel>; savedCards: SavedDrillCard[] }
  | { ok: false; status: number; error: string }
> {
  const session = parseSessionKey(sessionKey);
  if (!session || !cardId.trim() || cardId.length > 800) {
    return { ok: false, status: 404, error: "Drill not found." };
  }
  const dax = buildDrillSessionRowsDax(session);
  if (!dax) return { ok: false, status: 404, error: "Drill not found." };

  const rowsResult = await executePowerBiDaxQuery(dax);
  if (!rowsResult.ok) {
    logPowerBiError("drillAnalysis.historyDetail", rowsResult.error);
    return { ok: false, status: 502, error: "Drill details could not be loaded." };
  }

  const saved = await loadSavedCards(buildSessionKey(session));
  if (!saved.ok && !cardId.startsWith("ungrouped:")) {
    return { ok: false, status: 503, error: "Saved drill grouping could not be loaded." };
  }

  const parsed = firstResultRows(rowsResult.results).map((row) => parseDrillSourceRow(row));
  const built = buildOccurrences(session, parsed);
  const model = buildDrillAnalysisModel({
    session,
    occurrences: built.occurrences,
    savedCards: saved.ok ? saved.cards : [],
    player: null,
    excludedBlankDrillRows: built.excludedBlankDrillRows,
    excludedBlankPlayerRows: built.excludedBlankPlayerRows,
  });
  return { ok: true, model, savedCards: saved.ok ? saved.cards : [] };
}

export async function loadDrillHistoryDetail(
  sessionKey: string,
  cardId: string
): Promise<{ ok: true; detail: HistoryDetail & { note: string } } | { ok: false; status: number; error: string }> {
  const loaded = await loadHistorySessionModel(sessionKey, cardId);
  if (!loaded.ok) return loaded;
  const detail = historyDetailFromModel(loaded.model, cardId);
  if (!detail) return { ok: false, status: 404, error: "Drill not found." };
  const note = await loadHistoryNote(sessionKey, cardId);
  return { ok: true, detail: { ...detail, note } };
}
