import { NextResponse } from "next/server";
import { requireDrillAnalysisStaff } from "@/lib/drillAnalysis/access.server";
import { readPlanImage } from "@/lib/drillAnalysis/trainingPlan.server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireDrillAnalysisStaff();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const url = new URL(request.url);
  const image = await readPlanImage(url.searchParams.get("planId") ?? "", url.searchParams.get("itemId") ?? "");
  if (!image.ok) return NextResponse.json({ error: image.error }, { status: image.status });
  return new NextResponse(image.bytes, {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
}
