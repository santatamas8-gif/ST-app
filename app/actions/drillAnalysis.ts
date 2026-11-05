"use server";

import { revalidatePath } from "next/cache";
import { requireDrillAnalysisStaff } from "@/lib/drillAnalysis/access.server";
import { DRILL_ANALYSIS_IMAGE_BUCKET, isDrillImagePath } from "@/lib/drillAnalysis/images";
import { parseSessionKey } from "@/lib/drillAnalysis/keys";
import { loadSavedCards } from "@/lib/drillAnalysis/load.server";
import { buildOccurrences, parseDrillSourceRow } from "@/lib/drillAnalysis/metrics";
import { buildDrillSessionRowsDax } from "@/lib/drillAnalysis/query";
import { DRILL_ANALYSIS_SCOPE, type LayoutCardInput } from "@/lib/drillAnalysis/types";
import { validateLayoutSave } from "@/lib/drillAnalysis/validateLayout";
import { executePowerBiDaxQuery } from "@/lib/powerbi/client.server";
import { firstResultRows } from "@/lib/powerbi/queries/rowUtils";
import { createAdminClient } from "@/lib/supabase/admin";

export async function saveDrillAnalysisLayout(input: {
  sessionKey: string;
  cards: LayoutCardInput[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireDrillAnalysisStaff();
  if (!access.ok) return { ok: false, error: access.error };

  const session = parseSessionKey(input.sessionKey);
  if (!session) return { ok: false, error: "The session identifier is not valid." };
  const dax = buildDrillSessionRowsDax(session);
  if (!dax) return { ok: false, error: "The session date is not valid." };

  const rowsResult = await executePowerBiDaxQuery(dax);
  if (!rowsResult.ok) return { ok: false, error: "Drill rows could not be checked against Power BI." };
  const built = buildOccurrences(
    session,
    firstResultRows(rowsResult.results).map((row) => parseDrillSourceRow(row))
  );

  const previous = await loadSavedCards(input.sessionKey);
  if (!previous.ok) return previous;

  const validated = validateLayoutSave({
    sessionKey: input.sessionKey,
    occurrences: built.occurrences,
    previousCards: previous.cards,
    cards: input.cards,
  });
  if (!validated.ok) return validated;

  const payload = validated.cards.map((card) => ({
    id: card.id,
    displayName: card.displayName,
    occurrenceKeys: card.occurrenceKeys,
    imagePath: card.imagePath,
  }));

  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("drill_analysis_replace_layout", {
      p_scope_key: DRILL_ANALYSIS_SCOPE,
      p_session_key: input.sessionKey,
      p_user_id: access.user.id,
      p_cards: payload,
    });
    if (error) {
      return { ok: false, error: "The drill layout could not be saved." };
    }

    const kept = new Set(validated.cards.map((card) => card.imagePath).filter((path): path is string => Boolean(path)));
    const removed = previous.cards
      .map((card) => card.imagePath)
      .filter((path): path is string => typeof path === "string" && isDrillImagePath(path) && !kept.has(path));
    if (removed.length > 0) {
      await admin.storage.from(DRILL_ANALYSIS_IMAGE_BUCKET).remove(removed);
    }
  } catch {
    return { ok: false, error: "The drill layout could not be saved." };
  }

  revalidatePath("/drill-analysis");
  return { ok: true };
}
