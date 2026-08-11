import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAppUser } from "@/lib/auth";
import { canSubmitMatchFeedbackResponse } from "@/lib/matchFeedback/auth";
import { validateSubmitMatchFeedbackRequest } from "@/lib/matchFeedback/submitValidation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canSubmitMatchFeedbackResponse(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const validation = validateSubmitMatchFeedbackRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const data = validation.data;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { data: participant, error: partError } = await admin
    .from("match_feedback_participants")
    .select("player_id")
    .eq("match_id", data.matchId)
    .eq("player_id", data.playerId)
    .maybeSingle();

  if (partError) {
    console.error("[kiosk-match/submit] participant check failed", partError);
    return NextResponse.json({ error: "Failed to verify participant." }, { status: 500 });
  }
  if (!participant) {
    return NextResponse.json(
      { error: "Player is not a participant for this match." },
      { status: 400 }
    );
  }

  const payload = {
    match_id: data.matchId,
    player_id: data.playerId,
    pre_match_feelings: data.preMatchFeelings,
    pre_match_other_text: data.preMatchOtherText,
    physical_demand: data.physicalDemand,
    performance_rating: data.performanceRating,
    physical_dropoff: data.physicalDropoff,
    mental_demand: data.mentalDemand,
  };

  const { data: existing, error: existingError } = await admin
    .from("match_feedback_responses")
    .select("id, updated_at")
    .eq("match_id", data.matchId)
    .eq("player_id", data.playerId)
    .maybeSingle();

  if (existingError) {
    console.error("[kiosk-match/submit] existing lookup failed", existingError);
    return NextResponse.json({ error: "Failed to load existing response." }, { status: 500 });
  }

  if (existing) {
    const { data: updated, error: updateError } = await admin
      .from("match_feedback_responses")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, updated_at")
      .single();

    if (updateError || !updated) {
      console.error("[kiosk-match/submit] update failed", updateError);
      return NextResponse.json({ error: updateError?.message ?? "Update failed." }, { status: 500 });
    }

    revalidatePath("/kiosk-rpe");
    revalidatePath("/wellness");

    return NextResponse.json({
      success: true,
      responseId: updated.id,
      updated: true,
      updatedAt: updated.updated_at,
      previousUpdatedAt: existing.updated_at,
    });
  }

  const { data: inserted, error: insertError } = await admin
    .from("match_feedback_responses")
    .insert(payload)
    .select("id, updated_at")
    .single();

  if (insertError || !inserted) {
    if (insertError?.code === "23505") {
      return NextResponse.json({ error: "A response already exists for this player." }, { status: 409 });
    }
    console.error("[kiosk-match/submit] insert failed", insertError);
    return NextResponse.json({ error: insertError?.message ?? "Insert failed." }, { status: 500 });
  }

  revalidatePath("/kiosk-rpe");
  revalidatePath("/wellness");

  return NextResponse.json({
    success: true,
    responseId: inserted.id,
    updated: false,
    updatedAt: inserted.updated_at,
  });
}
