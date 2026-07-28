import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { processAvatarImage } from "@/lib/players/processAvatarImage";

const BUCKET = "avatars";
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/x-png", "image/pjpeg"];

function detectImageType(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string
): { ext: "png" | "jpg"; contentType: string } | null {
  const type = mimeType.toLowerCase();
  if (type === "image/png" || type === "image/x-png") {
    return { ext: "png", contentType: "image/png" };
  }
  if (type === "image/jpeg" || type === "image/jpg" || type === "image/pjpeg") {
    return { ext: "jpg", contentType: "image/jpeg" };
  }

  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { ext: "png", contentType: "image/png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }

  const name = fileName.toLowerCase();
  if (name.endsWith(".png")) return { ext: "png", contentType: "image/png" };
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return { ext: "jpg", contentType: "image/jpeg" };

  return null;
}

async function ensureAvatarsBucket(
  admin: ReturnType<typeof createAdminClient>
): Promise<{ error: string | null }> {
  const { data: buckets } = await admin.storage.listBuckets();
  const hasBucket = buckets?.some((b) => b.name === BUCKET);
  const bucketOptions = {
    public: true,
    fileSizeLimit: MAX_SIZE_BYTES,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  };
  if (!hasBucket) {
    const { error: createErr } = await admin.storage.createBucket(BUCKET, bucketOptions);
    if (createErr) return { error: "Failed to create bucket: " + createErr.message };
  } else {
    const { error: updateErr } = await admin.storage.updateBucket(BUCKET, bucketOptions);
    if (updateErr) return { error: "Failed to update storage bucket: " + updateErr.message };
  }
  return { error: null };
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "Only admin can upload avatars." },
      { status: 403 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data." },
      { status: 400 }
    );
  }

  const targetUserId = formData.get("userId");
  const file = formData.get("file");
  if (typeof targetUserId !== "string" || !targetUserId.trim()) {
    return NextResponse.json(
      { error: "userId is required." },
      { status: 400 }
    );
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "file is required." },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File must be 5MB or smaller." },
      { status: 400 }
    );
  }

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const resolved = detectImageType(bytes, file.name, file.type);
  if (!resolved) {
    return NextResponse.json(
      { error: "Only JPEG and PNG are allowed." },
      { status: 400 }
    );
  }

  let processed;
  try {
    processed = await processAvatarImage(bytes);
  } catch {
    return NextResponse.json(
      { error: "Could not process image. Try another JPEG or PNG." },
      { status: 400 }
    );
  }

  const path = `${targetUserId}.${processed.ext}`;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error." },
      { status: 500 }
    );
  }

  const bucketResult = await ensureAvatarsBucket(admin);
  if (bucketResult.error) {
    return NextResponse.json({ error: bucketResult.error }, { status: 500 });
  }

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, processed.buffer, {
      contentType: processed.contentType,
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json(
      { error: "Upload failed: " + uploadErr.message },
      { status: 500 }
    );
  }

  // Prefer a single .jpg path after processing; remove leftover .png if present.
  if (resolved.ext === "png") {
    await admin.storage.from(BUCKET).remove([`${targetUserId}.png`]);
  }

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
  const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`;

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", targetUserId);

  if (profileErr) {
    return NextResponse.json(
      { error: "Failed to update profile: " + profileErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ avatar_url: avatarUrl });
}
