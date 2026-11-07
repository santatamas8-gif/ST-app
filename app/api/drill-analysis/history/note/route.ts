import { NextResponse } from "next/server";
import { requireDrillAnalysisStaff } from "@/lib/drillAnalysis/access.server";
import { loadDrillHistoryDetail } from "@/lib/drillAnalysis/history.server";
import { isHistoryNoteEntry, normalizeHistoryNote } from "@/lib/drillAnalysis/historyNote";
import { saveHistoryNote } from "@/lib/drillAnalysis/historyNote.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await requireDrillAnalysisStaff();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = (await request.json().catch(() => null)) as
    | { sessionKey?: unknown; cardId?: unknown; note?: unknown }
    | null;
  if (!body || typeof body.sessionKey !== "string" || typeof body.cardId !== "string") {
    return NextResponse.json({ error: "Drill not found." }, { status: 404 });
  }
  if (!isHistoryNoteEntry(body.sessionKey, body.cardId)) {
    return NextResponse.json({ error: "Drill not found." }, { status: 404 });
  }
  const note = normalizeHistoryNote(body.note);
  if (!note.ok) {
    return NextResponse.json({ error: "Note is too long." }, { status: 400 });
  }

  const detail = await loadDrillHistoryDetail(body.sessionKey, body.cardId);
  if (!detail.ok) {
    return NextResponse.json({ error: detail.error }, { status: detail.status });
  }

  const saved = await saveHistoryNote({
    sessionKey: body.sessionKey,
    entryId: body.cardId,
    note: note.note,
    userId: access.user.id,
  });
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: saved.status });
  }
  return NextResponse.json({ note: saved.note });
}
