/**
 * One-shot: download existing profile avatars, process to 512² JPEG, re-upload.
 * Usage: node --env-file=.env.local scripts/reprocess-avatars.mjs
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET = "avatars";
const SIZE = 512;

async function processAvatarImage(input) {
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize(SIZE, SIZE, {
      fit: "cover",
      position: "north",
      withoutEnlargement: false,
    })
    .sharpen({ sigma: 0.6 })
    .jpeg({
      quality: 92,
      mozjpeg: true,
      chromaSubsampling: "4:4:4",
    })
    .toBuffer();
}

function storagePathFromPublicUrl(url) {
  try {
    const u = new URL(url.split("?")[0]);
    const marker = `/object/public/${BUCKET}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("role", "player")
    .not("avatar_url", "is", null);

  if (error) {
    console.error("Failed to load profiles:", error.message);
    process.exit(1);
  }

  const rows = (profiles ?? []).filter((p) => (p.avatar_url ?? "").trim());
  console.log(`Reprocessing ${rows.length} avatars…`);

  let ok = 0;
  let failed = 0;

  for (const row of rows) {
    const label = row.full_name || row.id;
    try {
      const sourceUrl = String(row.avatar_url).split("?")[0];
      const res = await fetch(sourceUrl);
      if (!res.ok) throw new Error(`download HTTP ${res.status}`);
      const input = Buffer.from(await res.arrayBuffer());
      const processed = await processAvatarImage(input);
      const path = `${row.id}.jpg`;

      const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, processed, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (uploadErr) throw new Error(uploadErr.message);

      const oldPath = storagePathFromPublicUrl(sourceUrl);
      if (oldPath && oldPath !== path) {
        await admin.storage.from(BUCKET).remove([oldPath]);
      }

      const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
      const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`;
      const { error: profileErr } = await admin
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", row.id);
      if (profileErr) throw new Error(profileErr.message);

      ok += 1;
      console.log(`  ✓ ${label}`);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${label}:`, err?.message ?? err);
    }
  }

  console.log(`Done. ok=${ok} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main();
