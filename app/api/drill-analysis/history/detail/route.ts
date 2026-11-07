import { NextResponse } from "next/server";
import { requireDrillAnalysisStaff } from "@/lib/drillAnalysis/access.server";
import { loadDrillHistoryDetail } from "@/lib/drillAnalysis/history.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await requireDrillAnalysisStaff();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = (await request.json().catch(() => null)) as { sessionKey?: unknown; cardId?: unknown } | null;
  if (!body || typeof body.sessionKey !== "string" || typeof body.cardId !== "string") {
    return NextResponse.json({ error: "Drill not found." }, { status: 404 });
  }
  if (body.sessionKey.length > 500) {
    return NextResponse.json({ error: "Drill not found." }, { status: 404 });
  }

  const detail = await loadDrillHistoryDetail(body.sessionKey, body.cardId);
  if (!detail.ok) {
    return NextResponse.json({ error: detail.error }, { status: detail.status });
  }
  return NextResponse.json(detail.detail);
}
