import { NextResponse } from "next/server";
import { getAppUser, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "chat-attachments";
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/x-png",
  "application/pdf",
];

type AttachmentKind = "image" | "pdf";

function resolveAttachment(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string
): { ext: string; contentType: string; kind: AttachmentKind } | null {
  const type = mimeType.toLowerCase();
  const name = fileName.toLowerCase();

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    if (
      bytes.length >= 4 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46
    ) {
      return { ext: "pdf", contentType: "application/pdf", kind: "pdf" };
    }
    if (type === "application/pdf" || name.endsWith(".pdf")) {
      return { ext: "pdf", contentType: "application/pdf", kind: "pdf" };
    }
    return null;
  }

  if (type === "image/png" || type === "image/x-png" || name.endsWith(".png")) {
    return { ext: "png", contentType: "image/png", kind: "image" };
  }
  if (type === "image/gif" || name.endsWith(".gif")) {
    return { ext: "gif", contentType: "image/gif", kind: "image" };
  }
  if (type === "image/webp" || name.endsWith(".webp")) {
    return { ext: "webp", contentType: "image/webp", kind: "image" };
  }
  if (
    type === "image/jpeg" ||
    type === "image/jpg" ||
    type === "image/pjpeg" ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg")
  ) {
    return { ext: "jpg", contentType: "image/jpeg", kind: "image" };
  }

  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { ext: "png", contentType: "image/png", kind: "image" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg", kind: "image" };
  }
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { ext: "pdf", contentType: "application/pdf", kind: "pdf" };
  }

  return null;
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const roomId = formData.get("roomId");
  const file = formData.get("file");
  if (typeof roomId !== "string" || !roomId.trim()) {
    return NextResponse.json({ error: "roomId is required." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file is required." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File must be 5MB or smaller." },
      { status: 400 }
    );
  }

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const resolved = resolveAttachment(bytes, file.name, file.type);
  if (!resolved) {
    return NextResponse.json(
      { error: "Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed." },
      { status: 400 }
    );
  }

  // Only admin or room members may upload attachments for this room
  if (!isAdmin(user.role)) {
    const supabase = await createClient();
    const { data: member } = await supabase
      .from("chat_room_members")
      .select("user_id")
      .eq("room_id", roomId.trim())
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) {
      return NextResponse.json({ error: "You are not a member of this room." }, { status: 403 });
    }
  }

  const { ext, contentType, kind } = resolved;
  const uuid = crypto.randomUUID();
  const path = `${roomId}/${uuid}.${ext}`;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const bucketOptions = {
    public: true,
    fileSizeLimit: MAX_SIZE_BYTES,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  };

  const { data: buckets } = await admin.storage.listBuckets();
  const hasBucket = buckets?.some((b) => b.name === BUCKET);
  if (!hasBucket) {
    const { error: createErr } = await admin.storage.createBucket(BUCKET, bucketOptions);
    if (createErr) {
      return NextResponse.json(
        { error: "Failed to create bucket: " + createErr.message },
        { status: 500 }
      );
    }
  } else {
    const { error: updateErr } = await admin.storage.updateBucket(BUCKET, bucketOptions);
    if (updateErr) {
      return NextResponse.json(
        { error: "Failed to update storage bucket: " + updateErr.message },
        { status: 500 }
      );
    }
  }

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, buf, {
      contentType,
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json(
      { error: "Upload failed: " + uploadErr.message },
      { status: 500 }
    );
  }

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: urlData.publicUrl, kind, name: file.name.trim() || null });
}
