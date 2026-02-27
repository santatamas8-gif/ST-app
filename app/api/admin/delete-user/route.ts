import { NextResponse } from "next/server";
import { getAppUser, isImmutableAdminEmail } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "Only admin can delete users." },
      { status: 403 }
    );
  }

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) {
    return NextResponse.json(
      { error: "User ID is required." },
      { status: 400 }
    );
  }

  if (userId === user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 }
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error (missing service role key)." },
      { status: 500 }
    );
  }

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const targetEmail = authUser?.user?.email ?? null;
  if (isImmutableAdminEmail(targetEmail)) {
    return NextResponse.json(
      { error: "The primary admin cannot be removed." },
      { status: 403 }
    );
  }

  const { error: wellnessErr } = await admin
    .from("wellness")
    .delete()
    .eq("user_id", userId);
  if (wellnessErr) {
    return NextResponse.json(
      { error: "Failed to delete wellness data: " + wellnessErr.message },
      { status: 500 }
    );
  }

  const { error: sessionsErr } = await admin
    .from("sessions")
    .delete()
    .eq("user_id", userId);
  if (sessionsErr) {
    return NextResponse.json(
      { error: "Failed to delete sessions: " + sessionsErr.message },
      { status: 500 }
    );
  }

  try {
    await admin.from("availability").delete().eq("user_id", userId);
  } catch {
    // availability table may not exist
  }

  const { error: profileErr } = await admin
    .from("profiles")
    .delete()
    .eq("id", userId);
  if (profileErr) {
    return NextResponse.json(
      { error: "Failed to delete profile: " + profileErr.message },
      { status: 500 }
    );
  }

  const { error: authErr } = await admin.auth.admin.deleteUser(userId);
  if (authErr) {
    return NextResponse.json(
      { error: "Failed to remove auth user: " + authErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
