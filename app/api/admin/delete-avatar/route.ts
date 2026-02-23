import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "avatars";

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "Only admin can delete avatars." },
      { status: 403 }
    );
  }

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const targetUserId = body.userId;
  if (typeof targetUserId !== "string" || !targetUserId.trim()) {
    return NextResponse.json(
      { error: "userId is required." },
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

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", targetUserId);

  if (profileErr) {
    return NextResponse.json(
      { error: "Failed to clear avatar: " + profileErr.message },
      { status: 500 }
    );
  }

  for (const ext of ["jpg", "jpeg", "png"]) {
    await admin.storage.from(BUCKET).remove([`${targetUserId}.${ext}`]);
  }

  return NextResponse.json({ ok: true });
}
