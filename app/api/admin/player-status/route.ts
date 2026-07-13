import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_STATUSES = ["available", "limited", "unavailable", "injured", "rehab"] as const;

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json(
      { error: "Only admin can update player status." },
      { status: 403 }
    );
  }

  let body: { userId?: string; status?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required." },
      { status: 400 }
    );
  }
  if (!ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
    return NextResponse.json(
      { error: "status must be one of: available, limited, unavailable, injured, rehab." },
      { status: 400 }
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error." },
      { status: 500 }
    );
  }

  const { error } = await admin
    .from("player_status")
    .upsert(
      {
        user_id: userId,
        status,
        status_notes: notes,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: "user_id" }
    );

  if (error) {
    return NextResponse.json(
      { error: "Failed to update status: " + error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
