import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getAppUser } from "@/lib/auth";
import {
  buildMixedKioskBatchRows,
  isEligibleSameDayPhoneSubmission,
  type ExistingKioskSubmissionRow,
} from "@/lib/kioskRpe/existingSubmission";
import { validateKioskRpeSubmitRequest } from "@/lib/kioskRpe/submitValidation";
import { createAdminClient } from "@/lib/supabase/admin";

const SESSION_FIELDS =
  "id, user_id, date, duration, rpe, load, session_type, matchday_tag, kiosk_batch_id, created_at";

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

  const kioskBatchId = randomUUID();
  const { data: existingRowsData, error: existingRowsError } = await admin
    .from("sessions")
    .select(SESSION_FIELDS)
    .eq("date", date)
    .in("user_id", playerIds);

  if (existingRowsError) {
    console.error("[kiosk-rpe/submit] existing row validation failed", existingRowsError);
    return NextResponse.json({ error: "Failed to verify existing sessions." }, { status: 500 });
  }

  const existingRows = (existingRowsData ?? []) as ExistingKioskSubmissionRow[];
  const rowsByPlayerId = new Map<string, ExistingKioskSubmissionRow[]>();
  for (const row of existingRows) {
    const rows = rowsByPlayerId.get(row.user_id) ?? [];
    rows.push(row);
    rowsByPlayerId.set(row.user_id, rows);
  }

  const eligibleRowsByPlayerId: Record<string, ExistingKioskSubmissionRow | undefined> = {};
  for (const entry of entries) {
    const playerRows = rowsByPlayerId.get(entry.playerId) ?? [];
    const finalizedRows = playerRows.filter((row) => (row.kiosk_batch_id ?? "").trim() !== "");
    if (finalizedRows.length > 0) {
      return NextResponse.json(
        { error: "One or more players already have a finalized RPE for this day." },
        { status: 409 }
      );
    }

    const eligibleRows = playerRows.filter((row) =>
      isEligibleSameDayPhoneSubmission(row, { playerId: entry.playerId, date })
    );
    if (eligibleRows.length > 1) {
      console.warn("[kiosk-rpe/submit] multiple eligible same-day rows", {
        date,
        playerId: entry.playerId,
      });
      return NextResponse.json(
        { error: "One or more players have duplicate same-day RPE submissions." },
        { status: 409 }
      );
    }
    if (eligibleRows.length === 1) {
      if (entry.existingSessionId && entry.existingSessionId !== eligibleRows[0].id) {
        return NextResponse.json(
          { error: "Existing RPE submission no longer matches this player." },
          { status: 409 }
        );
      }
      eligibleRowsByPlayerId[entry.playerId] = eligibleRows[0];
      continue;
    }

    if (entry.existingSessionId || playerRows.length > 0) {
      return NextResponse.json(
        { error: "One or more players already have RPE data for this day." },
        { status: 409 }
      );
    }
  }

  const { updates, inserts } = buildMixedKioskBatchRows({
    date,
    entries,
    existingRowsByPlayerId: eligibleRowsByPlayerId,
    kioskBatchId,
  });

  const insertRows = inserts.map((row) => ({ id: randomUUID(), ...row }));
  const upsertRows = [...updates, ...insertRows];
  const { error: upsertError } = await admin.from("sessions").upsert(upsertRows, {
    onConflict: "id",
  });

  if (upsertError) {
    console.error("[kiosk-rpe/submit] mixed batch upsert failed", upsertError);
    return NextResponse.json({ error: "Failed to save sessions." }, { status: 500 });
  }

  revalidatePath("/rpe");
  revalidatePath("/dashboard");
  revalidatePath("/players", "layout");

  return NextResponse.json({
    success: true,
    insertedCount: upsertRows.length,
    updatedCount: updates.length,
    newCount: inserts.length,
  });
}
