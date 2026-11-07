import { NextResponse } from "next/server";
import { requireDrillAnalysisStaff } from "@/lib/drillAnalysis/access.server";
import { loadDrillHistoryCatalog } from "@/lib/drillAnalysis/history.server";

export const runtime = "nodejs";

export async function GET() {
  const access = await requireDrillAnalysisStaff();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const catalog = await loadDrillHistoryCatalog();
  if (!catalog.ok) {
    return NextResponse.json({ error: catalog.error }, { status: 502 });
  }
  return NextResponse.json(catalog.catalog);
}
