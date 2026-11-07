import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isHistoryNoteEntry } from "@/lib/drillAnalysis/historyNote";
import { DRILL_ANALYSIS_SCOPE } from "@/lib/drillAnalysis/types";

function missingNotesTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  return error.code === "42P01" || error.code === "PGRST205" || /drill_analysis_history_notes/i.test(message);
}

/** Shared staff note for one history drill. Missing storage returns an empty note. */
export async function loadHistoryNote(sessionKey: string, entryId: string): Promise<string> {
  if (!isHistoryNoteEntry(sessionKey, entryId)) return "";
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("drill_analysis_history_notes")
      .select("note")
      .eq("scope_key", DRILL_ANALYSIS_SCOPE)
      .eq("session_key", sessionKey)
      .eq("entry_id", entryId)
      .maybeSingle();
    if (error || !data || typeof data.note !== "string") return "";
    return data.note;
  } catch {
    return "";
  }
}

export async function saveHistoryNote(input: {
  sessionKey: string;
  entryId: string;
  note: string | null;
  userId: string;
}): Promise<{ ok: true; note: string } | { ok: false; status: number; error: string }> {
  if (!isHistoryNoteEntry(input.sessionKey, input.entryId)) {
    return { ok: false, status: 404, error: "Drill not found." };
  }
  try {
    const admin = createAdminClient();
    if (input.note === null) {
      const { error } = await admin
        .from("drill_analysis_history_notes")
        .delete()
        .eq("scope_key", DRILL_ANALYSIS_SCOPE)
        .eq("session_key", input.sessionKey)
        .eq("entry_id", input.entryId);
      if (error) {
        return {
          ok: false,
          status: missingNotesTable(error) ? 503 : 500,
          error: missingNotesTable(error) ? "Notes are not set up yet." : "The note could not be saved.",
        };
      }
      return { ok: true, note: "" };
    }

    const { error } = await admin.from("drill_analysis_history_notes").upsert(
      {
        scope_key: DRILL_ANALYSIS_SCOPE,
        session_key: input.sessionKey,
        entry_id: input.entryId,
        note: input.note,
        updated_by: input.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "scope_key,session_key,entry_id" }
    );
    if (error) {
      return {
        ok: false,
        status: missingNotesTable(error) ? 503 : 500,
        error: missingNotesTable(error) ? "Notes are not set up yet." : "The note could not be saved.",
      };
    }
    return { ok: true, note: input.note };
  } catch {
    return { ok: false, status: 500, error: "The note could not be saved." };
  }
}
