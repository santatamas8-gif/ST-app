import { NextResponse } from "next/server";
import { getAppUser, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "chat-attachments";
/** Direct-to-Supabase upload; bypasses Vercel 4.5MB serverless body limit. */
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

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

function resolveKind(fileName: string, mimeType: string): {
  ext: string;
  contentType: string;
  kind: AttachmentKind;
} | null {
  const type = (mimeType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();

  if (name.endsWith(".pdf") || type.includes("pdf")) {
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
  return null;
}

async function ensureBucket(admin: ReturnType<typeof createAdminClient>) {
  const { data: buckets, error: listErr } = await admin.storage.listBuckets();
  if (listErr) throw new Error("Storage listBuckets failed: " + listErr.message);

  const hasBucket = buckets?.some((b) => b.name === BUCKET);
  if (!hasBucket) {
    const { error: createErr } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });
    if (createErr) throw new Error("Failed to create bucket: " + createErr.message);
  } else {
    await admin.storage.updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });
  }
}

/**
 * Lightweight endpoint: returns a signed upload URL so the browser uploads
 * the file directly to Supabase (avoids Vercel FUNCTION_PAYLOAD_TOO_LARGE).
 */
export async function POST(request: Request) {
  try {
    const user = await getAppUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let body: {
      roomId?: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const roomId = (body.roomId ?? "").trim();
    const fileName = (body.fileName ?? "").trim();
    const mimeType = (body.mimeType ?? "").trim();
    const fileSize = Number(body.fileSize ?? 0);

    if (!roomId) {
      return NextResponse.json({ error: "roomId is required." }, { status: 400 });
    }
    if (!fileName) {
      return NextResponse.json({ error: "fileName is required." }, { status: 400 });
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ error: "fileSize is required." }, { status: 400 });
    }
    if (fileSize > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File must be 20MB or smaller." },
        { status: 400 }
      );
    }

    const resolved = resolveKind(fileName, mimeType);
    if (!resolved) {
      return NextResponse.json(
        {
          error: `Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed. (got type="${mimeType || "empty"}", name="${fileName}")`,
        },
        { status: 400 }
      );
    }

    if (!isAdmin(user.role)) {
      const supabase = await createClient();
      const { data: member } = await supabase
        .from("chat_room_members")
        .select("user_id")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!member) {
        return NextResponse.json(
          { error: "You are not a member of this room." },
          { status: 403 }
        );
      }
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json(
        { error: "Server configuration error (missing SUPABASE_SERVICE_ROLE_KEY)." },
        { status: 500 }
      );
    }

    await ensureBucket(admin);

    const path = `${roomId}/${crypto.randomUUID()}.${resolved.ext}`;
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (signErr || !signed?.token || !signed.path) {
      return NextResponse.json(
        {
          error:
            "Could not create upload URL: " +
            (signErr?.message ?? "unknown") +
            ". Run SQL: UPDATE storage.buckets SET allowed_mime_types = NULL, file_size_limit = 20971520 WHERE id = 'chat-attachments';",
        },
        { status: 500 }
      );
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(signed.path);

    return NextResponse.json({
      path: signed.path,
      token: signed.token,
      signedUrl: signed.signedUrl,
      publicUrl: urlData.publicUrl,
      contentType: resolved.contentType,
      kind: resolved.kind,
      name: fileName,
      maxBytes: MAX_SIZE_BYTES,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json({ error: "Prepare upload failed: " + message }, { status: 500 });
  }
}
