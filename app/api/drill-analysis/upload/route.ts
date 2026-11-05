import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { saveDrillAnalysisLayout } from "@/app/actions/drillAnalysis";
import { requireDrillAnalysisStaff } from "@/lib/drillAnalysis/access.server";
import {
  DRILL_ANALYSIS_IMAGE_BUCKET,
  MAX_DRILL_IMAGE_BYTES,
  detectDrillImage,
  isDrillImagePath,
} from "@/lib/drillAnalysis/images";
import { occurrenceMatchesSession } from "@/lib/drillAnalysis/keys";
import { loadSavedCards } from "@/lib/drillAnalysis/load.server";
import { layoutForDrillImage } from "@/lib/drillAnalysis/validateLayout";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const CARD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ensureCardId(input: {
  cardId: FormDataEntryValue | null;
  sessionKey: FormDataEntryValue | null;
  occurrenceKey: FormDataEntryValue | null;
}): Promise<{ ok: true; cardId: string } | { ok: false; error: string; status: number }> {
  if (typeof input.cardId === "string" && CARD_ID.test(input.cardId)) {
    return { ok: true, cardId: input.cardId };
  }
  if (typeof input.sessionKey !== "string" || typeof input.occurrenceKey !== "string") {
    return { ok: false, error: "Card not found.", status: 404 };
  }
  if (!occurrenceMatchesSession(input.occurrenceKey, input.sessionKey)) {
    return { ok: false, error: "This drill is not part of the selected session.", status: 400 };
  }

  const previous = await loadSavedCards(input.sessionKey);
  if (!previous.ok) return { ok: false, error: previous.error, status: 500 };
  const plan = layoutForDrillImage(previous.cards, input.occurrenceKey);
  if ("cardId" in plan) return { ok: true, cardId: plan.cardId };

  const saved = await saveDrillAnalysisLayout({ sessionKey: input.sessionKey, cards: plan.cards });
  if (!saved.ok) return { ok: false, error: saved.error, status: 400 };
  const reloaded = await loadSavedCards(input.sessionKey);
  if (!reloaded.ok) return { ok: false, error: reloaded.error, status: 500 };
  const created = reloaded.cards.find((card) => card.occurrenceKeys.includes(input.occurrenceKey));
  if (!created) return { ok: false, error: "Image upload failed.", status: 500 };
  return { ok: true, cardId: created.id };
}

async function ensurePrivateBucket(admin: ReturnType<typeof createAdminClient>) {
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw new Error("Could not read image storage.");
  const existing = buckets?.find((bucket) => bucket.name === DRILL_ANALYSIS_IMAGE_BUCKET);
  if (!existing) {
    const { error: createError } = await admin.storage.createBucket(DRILL_ANALYSIS_IMAGE_BUCKET, {
      public: false,
      fileSizeLimit: MAX_DRILL_IMAGE_BYTES,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    if (createError) throw new Error("Could not prepare image storage.");
    return;
  }
  if (existing.public) {
    await admin.storage.updateBucket(DRILL_ANALYSIS_IMAGE_BUCKET, { public: false });
  }
}

export async function POST(request: Request) {
  const access = await requireDrillAnalysisStaff();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_DRILL_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be 5MB or smaller." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectDrillImage(bytes);
  if (!detected) {
    return NextResponse.json({ error: "Only JPEG, PNG, and WebP images are allowed." }, { status: 400 });
  }

  const ensured = await ensureCardId({
    cardId: formData.get("cardId"),
    sessionKey: formData.get("sessionKey"),
    occurrenceKey: formData.get("occurrenceKey"),
  });
  if (!ensured.ok) {
    return NextResponse.json({ error: ensured.error }, { status: ensured.status });
  }
  const cardId = ensured.cardId;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { data: card, error: cardError } = await admin
    .from("drill_analysis_cards")
    .select("id, image_path")
    .eq("id", cardId)
    .maybeSingle();
  if (cardError || !card) {
    return NextResponse.json({ error: "Save the card before uploading an image." }, { status: 404 });
  }

  try {
    await ensurePrivateBucket(admin);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not prepare image storage." },
      { status: 500 }
    );
  }

  const path = `cards/${cardId}/${crypto.randomUUID()}.${detected.ext}`;
  const { error: uploadError } = await admin.storage.from(DRILL_ANALYSIS_IMAGE_BUCKET).upload(path, bytes, {
    contentType: detected.contentType,
    upsert: false,
  });
  if (uploadError) {
    return NextResponse.json({ error: "Image upload failed." }, { status: 500 });
  }

  const { error: updateError } = await admin
    .from("drill_analysis_cards")
    .update({ image_path: path, updated_by: access.user.id, updated_at: new Date().toISOString() })
    .eq("id", cardId);
  if (updateError) {
    await admin.storage.from(DRILL_ANALYSIS_IMAGE_BUCKET).remove([path]);
    return NextResponse.json({ error: "Image upload failed." }, { status: 500 });
  }

  const previous = card.image_path ? String(card.image_path) : null;
  if (previous && previous !== path && isDrillImagePath(previous)) {
    await admin.storage.from(DRILL_ANALYSIS_IMAGE_BUCKET).remove([previous]);
  }

  revalidatePath("/drill-analysis");
  return NextResponse.json({ ok: true });
}
