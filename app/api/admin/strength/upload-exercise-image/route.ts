import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EXERCISE_IMAGE_TYPES,
  MAX_EXERCISE_IMAGE_BYTES,
  STRENGTH_EXERCISE_IMAGES_BUCKET,
  extensionForMime,
  storagePathForExercise,
  withImageCacheBuster,
} from "@/lib/strength/exerciseImageStorage";
import { syncCardItemImageSnapshots } from "@/lib/strength/exerciseImages";

async function ensureBucket(admin: ReturnType<typeof createAdminClient>) {
  const { data: buckets } = await admin.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === STRENGTH_EXERCISE_IMAGES_BUCKET);
  if (exists) return;

  const { error } = await admin.storage.createBucket(STRENGTH_EXERCISE_IMAGES_BUCKET, {
    public: true,
    fileSizeLimit: MAX_EXERCISE_IMAGE_BYTES,
    allowedMimeTypes: [...EXERCISE_IMAGE_TYPES],
  });
  if (error) throw new Error("Failed to create bucket: " + error.message);
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const exerciseId = formData.get("exerciseId");
  const file = formData.get("file");
  if (typeof exerciseId !== "string" || !exerciseId.trim()) {
    return NextResponse.json({ error: "exerciseId is required." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required." }, { status: 400 });
  }
  if (!EXERCISE_IMAGE_TYPES.includes(file.type as (typeof EXERCISE_IMAGE_TYPES)[number])) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, and WebP images are allowed." },
      { status: 400 }
    );
  }
  if (file.size > MAX_EXERCISE_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be 3MB or smaller." }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { data: exercise } = await admin
    .from("strength_exercises")
    .select("id")
    .eq("id", exerciseId.trim())
    .maybeSingle();
  if (!exercise) {
    return NextResponse.json({ error: "Exercise not found." }, { status: 404 });
  }

  try {
    await ensureBucket(admin);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Bucket error" },
      { status: 500 }
    );
  }

  const ext = extensionForMime(file.type);
  const path = storagePathForExercise(exerciseId.trim(), ext);
  const buf = await file.arrayBuffer();

  const { error: uploadErr } = await admin.storage
    .from(STRENGTH_EXERCISE_IMAGES_BUCKET)
    .upload(path, buf, { contentType: file.type, upsert: true });

  if (uploadErr) {
    return NextResponse.json({ error: "Upload failed: " + uploadErr.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from(STRENGTH_EXERCISE_IMAGES_BUCKET).getPublicUrl(path);
  const imageUrl = withImageCacheBuster(urlData.publicUrl);

  const { error: updateErr } = await admin
    .from("strength_exercises")
    .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
    .eq("id", exerciseId.trim());

  if (updateErr) {
    return NextResponse.json({ error: "Failed to update exercise: " + updateErr.message }, { status: 500 });
  }

  await syncCardItemImageSnapshots(admin, exerciseId.trim(), imageUrl);

  return NextResponse.json({ image_url: imageUrl });
}
