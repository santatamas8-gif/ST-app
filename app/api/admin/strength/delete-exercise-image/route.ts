import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  STRENGTH_EXERCISE_IMAGES_BUCKET,
  storagePathsForExercise,
} from "@/lib/strength/exerciseImageStorage";
import { syncCardItemImageSnapshots } from "@/lib/strength/exerciseImages";

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let body: { exerciseId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const exerciseId = body.exerciseId?.trim();
  if (!exerciseId) {
    return NextResponse.json({ error: "exerciseId is required." }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { error: updateErr } = await admin
    .from("strength_exercises")
    .update({ image_url: null, updated_at: new Date().toISOString() })
    .eq("id", exerciseId);

  if (updateErr) {
    return NextResponse.json({ error: "Failed to clear image: " + updateErr.message }, { status: 500 });
  }

  await admin.storage.from(STRENGTH_EXERCISE_IMAGES_BUCKET).remove(storagePathsForExercise(exerciseId));
  await syncCardItemImageSnapshots(admin, exerciseId, null);

  return NextResponse.json({ ok: true });
}
