import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAppUser } from "@/lib/auth";
import { canDeleteMatchFeedback } from "@/lib/matchFeedback/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canDeleteMatchFeedback(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const matchId =
    body && typeof body === "object" && "matchId" in body
      ? (body as { matchId?: unknown }).matchId
      : undefined;

  if (typeof matchId !== "string" || !UUID_RE.test(matchId)) {
    return NextResponse.json({ error: "Valid matchId is required." }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { data: existing, error: lookupError } = await admin
    .from("match_feedback_matches")
    .select("id")
    .eq("id", matchId)
    .maybeSingle();

  if (lookupError) {
    console.error("[kiosk-match/delete] lookup failed", lookupError);
    return NextResponse.json({ error: "Failed to verify match." }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  const { error: responsesError } = await admin
    .from("match_feedback_responses")
    .delete()
    .eq("match_id", matchId);

  if (responsesError) {
    console.error("[kiosk-match/delete] responses delete failed", responsesError);
    return NextResponse.json({ error: "Failed to delete match responses." }, { status: 500 });
  }

  const { error: participantsError } = await admin
    .from("match_feedback_participants")
    .delete()
    .eq("match_id", matchId);

  if (participantsError) {
    console.error("[kiosk-match/delete] participants delete failed", participantsError);
    return NextResponse.json({ error: "Failed to delete match participants." }, { status: 500 });
  }

  const { error: matchError } = await admin
    .from("match_feedback_matches")
    .delete()
    .eq("id", matchId);

  if (matchError) {
    console.error("[kiosk-match/delete] match delete failed", matchError);
    return NextResponse.json({ error: "Failed to delete match." }, { status: 500 });
  }

  revalidatePath("/kiosk-rpe");
  revalidatePath("/wellness");

  return NextResponse.json({ success: true });
}
