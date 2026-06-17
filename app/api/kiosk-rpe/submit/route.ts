import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAppUser } from "@/lib/auth";
import { validateKioskRpeSubmitRequest } from "@/lib/kioskRpe/submitValidation";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessionLoad } from "@/utils/load";

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

  const validation = validateKioskRpeSubmitRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { date, entries } = validation.data;
  const playerIds = entries.map((entry) => entry.playerId);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id")
    .in("id", playerIds)
    .eq("role", "player");

  if (profilesError) {
    console.error("[kiosk-rpe/submit] player verification failed", profilesError);
    return NextResponse.json({ error: "Failed to verify players." }, { status: 500 });
  }

  const verifiedIds = new Set((profiles ?? []).map((row) => row.id as string));
  if (verifiedIds.size !== playerIds.length) {
    return NextResponse.json(
      { error: "One or more player IDs are invalid or not player profiles." },
      { status: 400 }
    );
  }

  const insertRows = entries.map((entry) => ({
    user_id: entry.playerId,
    date,
    duration: entry.durationMinutes,
    rpe: entry.rpe,
    load: sessionLoad(entry.durationMinutes, entry.rpe),
    session_type: entry.sessionType,
    matchday_tag: entry.matchdayTag,
  }));

  const { error: insertError } = await admin.from("sessions").insert(insertRows);

  if (insertError) {
    console.error("[kiosk-rpe/submit] batch insert failed", insertError);
    return NextResponse.json({ error: "Failed to save sessions." }, { status: 500 });
  }

  revalidatePath("/rpe");
  revalidatePath("/dashboard");
  revalidatePath("/players", "layout");

  return NextResponse.json({
    success: true,
    insertedCount: insertRows.length,
  });
}
