import { NextResponse } from "next/server";
import { getAppUser, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

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

/** Node/undici FormData may return Blob-like objects that fail `instanceof File`. */
function asUploadBlob(value: FormDataEntryValue | null): {
  blob: Blob;
  name: string;
  type: string;
  size: number;
} | null {
  if (value == null || typeof value === "string") return null;
  const blob = value as Blob & { name?: string; type?: string; size: number };
  if (typeof blob.arrayBuffer !== "function" || !blob.size) return null;
  const name = typeof blob.name === "string" && blob.name ? blob.name : "upload.bin";
  const type = typeof blob.type === "string" ? blob.type : "";
  return { blob, name, type, size: blob.size };
}

async function ensureBucketAllowsPdf(
  admin: ReturnType<typeof createAdminClient>
): Promise<void> {
  const { data: buckets, error: listErr } = await admin.storage.listBuckets();
  if (listErr) {
    throw new Error("Storage listBuckets failed: " + listErr.message);
  }

  const hasBucket = buckets?.some((b) => b.name === BUCKET);
  if (!hasBucket) {
    const { error: createErr } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });
    if (createErr) {
      throw new Error("Failed to create bucket: " + createErr.message);
    }
    return;
  }

  // Best-effort update; do not throw — upload may still work.
  await admin.storage.updateBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_SIZE_BYTES,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  });
}

export async function POST(request: Request) {
  try {
    const user = await getAppUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid form data (file may be too large for the server)." },
        { status: 400 }
      );
    }

    const roomId = formData.get("roomId");
    const upload = asUploadBlob(formData.get("file"));
    if (typeof roomId !== "string" || !roomId.trim()) {
      return NextResponse.json({ error: "roomId is required." }, { status: 400 });
    }
    if (!upload) {
      return NextResponse.json({ error: "file is required." }, { status: 400 });
    }
    if (upload.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File must be 5MB or smaller." },
        { status: 400 }
      );
    }

    const buf = await upload.blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const resolved = resolveAttachment(bytes, upload.name, upload.type);
    if (!resolved) {
      return NextResponse.json(
        {
          error: `Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed. (got type="${upload.type || "empty"}", name="${upload.name}")`,
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
        return NextResponse.json(
          { error: "You are not a member of this room." },
          { status: 403 }
        );
      }
    }

    const { ext, contentType, kind } = resolved;
    const path = `${roomId.trim()}/${crypto.randomUUID()}.${ext}`;

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json(
        { error: "Server configuration error (missing SUPABASE_SERVICE_ROLE_KEY)." },
        { status: 500 }
      );
    }

    await ensureBucketAllowsPdf(admin);

    let { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, buf, {
      contentType,
      upsert: false,
    });

    if (uploadErr) {
      // Retry after refreshing allow-list (covers image-only buckets).
      await admin.storage.updateBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_SIZE_BYTES,
        allowedMimeTypes: ALLOWED_MIME_TYPES,
      });
      ({ error: uploadErr } = await admin.storage.from(BUCKET).upload(path, buf, {
        contentType,
        upsert: true,
      }));
    }

    if (uploadErr) {
      return NextResponse.json(
        {
          error:
            "Storage upload failed: " +
            uploadErr.message +
            ". Run in Supabase SQL: UPDATE storage.buckets SET allowed_mime_types = NULL WHERE id = 'chat-attachments';",
        },
        { status: 500 }
      );
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({
      url: urlData.publicUrl,
      kind,
      name: upload.name.trim() || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json({ error: "Upload failed: " + message }, { status: 500 });
  }
}
