import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAppUser } from "@/lib/auth";
import { canCreateMatchFeedback } from "@/lib/matchFeedback/auth";
import {
  validateCreateMatchPlayers,
  validateCreateMatchRequest,
} from "@/lib/matchFeedback/createValidation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // REQUIRED: service-role bypasses RLS — enforce admin before any write.
  if (!canCreateMatchFeedback(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const validation = validateCreateMatchRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { opponent, matchDate, matchday, playerIds } = validation.data;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id, role")
    .in("id", playerIds);

  if (profileError) {
    console.error("[kiosk-match/create] profile lookup failed", profileError);
    return NextResponse.json({ error: "Failed to verify players." }, { status: 500 });
  }

  const playerCheck = validateCreateMatchPlayers(playerIds, profiles ?? []);
  if (!playerCheck.ok) {
    return NextResponse.json({ error: playerCheck.error }, { status: 400 });
  }

  if ((profiles ?? []).length !== playerIds.length) {
    return NextResponse.json({ error: "One or more players were not found." }, { status: 400 });
  }

  const { data: match, error: matchError } = await admin
    .from("match_feedback_matches")
    .insert({
      opponent,
      match_date: matchDate,
      matchday,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (matchError || !match) {
    console.error("[kiosk-match/create] match insert failed", matchError);
    return NextResponse.json({ error: matchError?.message ?? "Failed to create match." }, { status: 500 });
  }

  const participantRows = playerIds.map((player_id) => ({
    match_id: match.id as string,
    player_id,
  }));

  const { error: partError } = await admin.from("match_feedback_participants").insert(participantRows);

  if (partError) {
    console.error("[kiosk-match/create] participants insert failed", partError);
    await admin.from("match_feedback_matches").delete().eq("id", match.id);
    return NextResponse.json({ error: "Failed to save match participants." }, { status: 500 });
  }

  revalidatePath("/kiosk-rpe");
  revalidatePath("/wellness");

  return NextResponse.json({ success: true, matchId: match.id });
}
