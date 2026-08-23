import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAppUser } from "@/lib/auth";
import { canAddMatchFeedbackParticipants } from "@/lib/matchFeedback/auth";
import {
  validateAddMatchParticipantsRequest,
  validateCreateMatchPlayers,
} from "@/lib/matchFeedback/createValidation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAddMatchFeedbackParticipants(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const validation = validateAddMatchParticipantsRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { matchId, playerIds } = validation.data;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { data: match, error: matchError } = await admin
    .from("match_feedback_matches")
    .select("id")
    .eq("id", matchId)
    .maybeSingle();

  if (matchError) {
    console.error("[kiosk-match/add-participants] match lookup failed", matchError);
    return NextResponse.json({ error: "Failed to verify match." }, { status: 500 });
  }
  if (!match) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id, role")
    .in("id", playerIds);

  if (profileError) {
    console.error("[kiosk-match/add-participants] profile lookup failed", profileError);
    return NextResponse.json({ error: "Failed to verify players." }, { status: 500 });
  }

  const playerCheck = validateCreateMatchPlayers(playerIds, profiles ?? []);
  if (!playerCheck.ok) {
    return NextResponse.json({ error: playerCheck.error }, { status: 400 });
  }

  if ((profiles ?? []).length !== playerIds.length) {
    return NextResponse.json({ error: "One or more players were not found." }, { status: 400 });
  }

  const { data: existingRows, error: existingError } = await admin
    .from("match_feedback_participants")
    .select("player_id")
    .eq("match_id", matchId)
    .in("player_id", playerIds);

  if (existingError) {
    console.error("[kiosk-match/add-participants] existing lookup failed", existingError);
    return NextResponse.json({ error: "Failed to check existing participants." }, { status: 500 });
  }

  const already = new Set((existingRows ?? []).map((r: { player_id: string }) => r.player_id));
  const toAdd = playerIds.filter((id) => !already.has(id));

  if (toAdd.length === 0) {
    return NextResponse.json(
      { error: "Selected players are already in this match." },
      { status: 400 }
    );
  }

  const { error: insertError } = await admin.from("match_feedback_participants").insert(
    toAdd.map((player_id) => ({
      match_id: matchId,
      player_id,
    }))
  );

  if (insertError) {
    console.error("[kiosk-match/add-participants] insert failed", insertError);
    return NextResponse.json({ error: "Failed to add players." }, { status: 500 });
  }

  revalidatePath("/kiosk-rpe");
  revalidatePath("/wellness");

  return NextResponse.json({ success: true, addedPlayerIds: toAdd });
}
