import { NextResponse } from "next/server";
import { requireDrillAnalysisStaff } from "@/lib/drillAnalysis/access.server";
import { captureTrainingPlanItem } from "@/lib/drillAnalysis/trainingPlan.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await requireDrillAnalysisStaff();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = (await request.json().catch(() => null)) as { sessionKey?: unknown; cardId?: unknown } | null;
  if (!body || typeof body.sessionKey !== "string" || typeof body.cardId !== "string" || body.sessionKey.length > 500) {
    return NextResponse.json({ error: "Drill not found." }, { status: 404 });
  }
  const captured = await captureTrainingPlanItem(body.sessionKey, body.cardId);
  if (!captured.ok) return NextResponse.json({ error: captured.error }, { status: captured.status });
  return NextResponse.json({
    snapshot: captured.item.snapshot,
    hasImage: Boolean(captured.item.sourceImagePath),
  });
}
