import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { requireMovementPrepAdmin } from "@/lib/movementPrep/access.server";
import { getMovementPrepMedia, parseByteRange } from "@/lib/movementPrep/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEDIA_DIR = path.join(process.cwd(), "content", "movement-prep");

function mediaHeaders(contentType: string, extra?: Record<string, string>) {
  return {
    "Content-Type": contentType,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Content-Disposition": "inline",
    ...extra,
  };
}

export async function GET(request: Request) {
  const access = await requireMovementPrepAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const id = new URL(request.url).searchParams.get("id") ?? "";
  const media = getMovementPrepMedia(id);
  if (!media || media.filename.includes("/") || media.filename.includes("\\")) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const filePath = path.resolve(MEDIA_DIR, media.filename);
  if (path.dirname(filePath) !== path.resolve(MEDIA_DIR)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let size = 0;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const range = parseByteRange(rangeHeader, size);
    if (!range) {
      return new NextResponse(null, {
        status: 416,
        headers: mediaHeaders(media.contentType, {
          "Content-Range": `bytes */${size}`,
        }),
      });
    }
    const stream = Readable.toWeb(
      createReadStream(filePath, { start: range.start, end: range.end })
    ) as ReadableStream<Uint8Array>;
    return new NextResponse(stream, {
      status: 206,
      headers: mediaHeaders(media.contentType, {
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        "Content-Length": String(range.end - range.start + 1),
      }),
    });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;
  return new NextResponse(stream, {
    status: 200,
    headers: mediaHeaders(media.contentType, {
      "Content-Length": String(size),
    }),
  });
}
