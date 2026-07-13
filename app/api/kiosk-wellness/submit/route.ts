import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAppUser } from "@/lib/auth";
import { verifyPlayerInitials } from "@/lib/kioskWellness/initials";
import { validateKioskWellnessSubmitRequest } from "@/lib/kioskWellness/submitValidation";
import { playerDisplayName } from "@/lib/players/listPlayers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sleepDurationHours } from "@/utils/sleep";

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin" && user.role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const validation = validateKioskWellnessSubmitRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { date, entry } = validation.data;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", entry.playerId)
    .maybeSingle();

  if (profileError) {
    console.error("[kiosk-wellness/submit] profile lookup failed", profileError);
    return NextResponse.json({ error: "Failed to verify player." }, { status: 500 });
  }

  if (!profile || profile.role !== "player") {
    return NextResponse.json({ error: "Invalid player." }, { status: 400 });
  }

  const displayName = playerDisplayName(profile.full_name, profile.email);
  if (!verifyPlayerInitials(displayName, entry.initials)) {
    return NextResponse.json({ error: "Incorrect player initials." }, { status: 403 });
  }

  const { data: existing } = await admin
    .from("wellness")
    .select("id")
    .eq("user_id", entry.playerId)
    .eq("date", date)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "This player has already submitted for today." }, { status: 409 });
  }

  const sleepDuration =
    entry.bed_time && entry.wake_time
      ? sleepDurationHours(entry.bed_time, entry.wake_time)
      : null;

  const bodyPartsFiltered =
    entry.body_parts && Object.keys(entry.body_parts).length > 0
      ? Object.fromEntries(
          Object.entries(entry.body_parts).filter(
            ([, value]) => (value.s ?? 0) > 0 || (value.p ?? 0) > 0
          )
        )
      : null;

  const { error: insertError } = await admin.from("wellness").insert({
    user_id: entry.playerId,
    date,
    bed_time: entry.bed_time ?? null,
    wake_time: entry.wake_time ?? null,
    sleep_duration: sleepDuration,
    sleep_quality: entry.sleep_quality,
    soreness: entry.soreness,
    fatigue: entry.fatigue,
    stress: entry.stress,
    mood: entry.mood,
    illness: entry.illness ?? false,
    bodyweight: null,
    body_parts: bodyPartsFiltered,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "This player has already submitted for today." }, { status: 409 });
    }
    console.error("[kiosk-wellness/submit] insert failed", insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  revalidatePath("/wellness");
  revalidatePath("/dashboard");
  revalidatePath("/kiosk-rpe");

  return NextResponse.json({ success: true });
}
