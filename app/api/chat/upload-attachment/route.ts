import { NextResponse } from "next/server";
import { getAppUser, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "chat-attachments";
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/** Kept for createBucket defaults; we also clear MIME restrictions so PDF always works. */
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/x-png",
  "application/pdf",
  "application/x-pdf",
  "application/octet-stream",
];

type AttachmentKind = "image" | "pdf";

function resolveAttachment(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string
): { ext: string; contentType: string; kind: AttachmentKind } | null {
  const type = (mimeType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();
  const isPdfMagic =
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46;

  if (name.endsWith(".pdf") || type.includes("pdf") || isPdfMagic) {
    return { ext: "pdf", contentType: "application/pdf", kind: "pdf" };
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

  return null;
}

async function ensureChatAttachmentsBucket(
  admin: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  const { data: buckets } = await admin.storage.listBuckets();
  const hasBucket = buckets?.some((b) => b.name === BUCKET);

  if (!hasBucket) {
    const { error: createErr } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });
    if (createErr) return "Failed to create bucket: " + createErr.message;
  }

  // Prefer explicit allow-list including PDF.
  await admin.storage.updateBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_SIZE_BYTES,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  });

  // Hard fix: clear MIME restriction in storage.buckets so older buckets
  // that only allow images stop rejecting PDF (updateBucket alone can be a no-op).
  try {
    await admin.schema("storage").from("buckets").update({
      public: true,
      file_size_limit: MAX_SIZE_BYTES,
      allowed_mime_types: null,
    }).eq("id", BUCKET);
  } catch {
    // schema() may be unavailable; ignore — upload retry below still helps.
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
      {
        error: `Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed. (got type="${file.type || "empty"}", name="${file.name}")`,
      },
      { status: 400 }
    );
  }

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
  const path = `${roomId.trim()}/${uuid}.${ext}`;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const ensureErr = await ensureChatAttachmentsBucket(admin);
  if (ensureErr) {
    return NextResponse.json({ error: ensureErr }, { status: 500 });
  }

  let { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, buf, {
    contentType,
    upsert: false,
  });

  // Retry once after forcing unrestricted MIME types (common when bucket was image-only).
  if (uploadErr && /mime|not allowed|invalid|type|rejected/i.test(uploadErr.message)) {
    await admin.storage.updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });
    try {
      await admin.schema("storage").from("buckets").update({
        allowed_mime_types: null,
        file_size_limit: MAX_SIZE_BYTES,
        public: true,
      }).eq("id", BUCKET);
    } catch {
      // ignore
    }
    ({ error: uploadErr } = await admin.storage.from(BUCKET).upload(path, buf, {
      contentType,
      upsert: true,
    }));
  }

  if (uploadErr) {
    return NextResponse.json(
      {
        error:
          "Upload failed: " +
          uploadErr.message +
          " — Fix: Supabase → Storage → chat-attachments → Allowed MIME types → add application/pdf (or clear the list).",
      },
      { status: 500 }
    );
  }

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({
    url: urlData.publicUrl,
    kind,
    name: file.name.trim() || null,
  });
}
