import { NextResponse } from "next/server";
import { requireDrillAnalysisStaff } from "@/lib/drillAnalysis/access.server";
import { parsePlanRequest } from "@/lib/drillAnalysis/trainingPlan";
import { listTrainingPlans, loadTrainingPlan, saveTrainingPlan } from "@/lib/drillAnalysis/trainingPlan.server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireDrillAnalysisStaff();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const plan = await loadTrainingPlan(id);
    if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: plan.status });
    return NextResponse.json(plan.plan);
  }
  const plans = await listTrainingPlans();
  if (!plans.ok) return NextResponse.json({ error: plans.error }, { status: plans.status });
  return NextResponse.json({ plans: plans.plans });
}

export async function POST(request: Request) {
  const access = await requireDrillAnalysisStaff();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parsePlanRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const planId = body && typeof body.id === "string" && body.id ? body.id : null;
  const saved = await saveTrainingPlan({
    planId,
    name: parsed.name,
    planDate: parsed.planDate,
    notes: parsed.notes,
    items: parsed.items,
    userId: access.user.id,
  });
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status });
  return NextResponse.json(saved.plan);
}
