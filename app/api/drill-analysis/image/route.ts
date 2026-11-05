import { NextResponse } from "next/server";
import { requireDrillAnalysisStaff } from "@/lib/drillAnalysis/access.server";
import {
  DRILL_ANALYSIS_IMAGE_BUCKET,
  drillImageContentType,
  isDrillImagePath,
} from "@/lib/drillAnalysis/images";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const CARD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const access = await requireDrillAnalysisStaff();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const cardId = new URL(request.url).searchParams.get("cardId") ?? "";
  if (!CARD_ID.test(cardId)) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { data: card, error } = await admin
    .from("drill_analysis_cards")
    .select("image_path")
    .eq("id", cardId)
    .maybeSingle();
  if (error || !card?.image_path || !isDrillImagePath(String(card.image_path))) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  const path = String(card.image_path);
  const contentType = drillImageContentType(path);
  if (!contentType) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  const { data: file, error: downloadError } = await admin.storage.from(DRILL_ANALYSIS_IMAGE_BUCKET).download(path);
  if (downloadError || !file) {
    return NextResponse.json({ error: "Image failed to load." }, { status: 404 });
  }

  const bytes = await file.arrayBuffer();
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
}
