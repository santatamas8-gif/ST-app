import { NextRequest } from "next/server";

const URL_REGEX = /^https?:\/\/[^\s/]+(\/[^\s]*)?$/i;

function extractMeta(html: string): { title?: string; image?: string; description?: string } {
  const result: { title?: string; image?: string; description?: string } = {};
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (ogTitle) result.title = ogTitle[1];
  const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogImage) result.image = ogImage[1];
  const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
  if (ogDesc) result.description = ogDesc[1];
  if (!result.title) {
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTag) result.title = titleTag[1];
  }
  return result;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url || !URL_REGEX.test(url)) {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LinkPreview/1.0)" },
    });
    clearTimeout(timeout);
    if (!res.ok) return Response.json({ error: "Fetch failed" }, { status: 400 });
    const html = await res.text();
    const meta = extractMeta(html);
    return Response.json(meta);
  } catch {
    return Response.json({ error: "Failed to fetch" }, { status: 400 });
  }
}
