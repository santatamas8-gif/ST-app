/**
 * Full ST-AMS disaster-recovery backup:
 * - public schema data (all tables)
 * - auth users
 * - storage buckets + files
 * - schema reference (migrations)
 * - manifest + RESTORE guide
 *
 * Usage (from project root):
 *   node scripts/backup-st-ams.mjs
 *   node scripts/backup-st-ams.mjs --out "C:\Users\berde\Desktop"
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import {
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

const PUBLIC_TABLES = [
  "users",
  "profiles",
  "wellness",
  "sessions",
  "availability",
  "schedule",
  "player_status",
  "team_settings",
  "chat_rooms",
  "chat_messages",
  "chat_room_members",
  "chat_room_reads",
  "message_likes",
  "strength_profiles",
  "strength_exercises",
  "strength_set_rep_schemes",
  "strength_set_rep_scheme_items",
  "daily_strength_sessions",
  "daily_strength_session_exercises",
  "daily_strength_session_sets",
  "daily_strength_player_cards",
  "daily_strength_player_card_items",
];

const PAGE_SIZE = 1000;

function loadEnvLocal() {
  const envPath = join(PROJECT_ROOT, ".env.local");
  if (!existsSync(envPath)) {
    throw new Error("Missing .env.local in project root.");
  }
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function todayStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getGitCommit() {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function getProjectRef(url) {
  const match = url?.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

async function fetchAllRows(supabase, table) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("Could not find")) {
        return { skipped: true, reason: error.message, rows: [] };
      }
      throw new Error(`Table ${table}: ${error.message}`);
    }
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { skipped: false, rows };
}

async function fetchAllAuthUsers(supabase) {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });
    if (error) throw new Error(`Auth export: ${error.message}`);
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    page += 1;
  }
  return users;
}

async function listStoragePaths(supabase, bucket, prefix = "") {
  const paths = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Storage list ${bucket}/${prefix}: ${error.message}`);
    if (!data?.length) break;

    for (const item of data) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
      const isFolder = item.id == null;
      if (isFolder) {
        const nested = await listStoragePaths(supabase, bucket, itemPath);
        paths.push(...nested);
      } else {
        paths.push(itemPath);
      }
    }

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return paths;
}

async function downloadStorageFile(supabase, bucket, filePath, destPath) {
  const { data, error } = await supabase.storage.from(bucket).download(filePath);
  if (error) throw new Error(`Download ${bucket}/${filePath}: ${error.message}`);
  mkdirSync(dirname(destPath), { recursive: true });
  const buffer = Buffer.from(await data.arrayBuffer());
  writeFileSync(destPath, buffer);
}

function copySchemaReference(destDir) {
  const schemaRefDir = join(destDir, "database", "schema-reference");
  mkdirSync(schemaRefDir, { recursive: true });

  const schemaSql = join(PROJECT_ROOT, "supabase", "schema.sql");
  if (existsSync(schemaSql)) {
    cpSync(schemaSql, join(schemaRefDir, "schema.sql"));
  }

  const migrationsSrc = join(PROJECT_ROOT, "supabase", "migrations");
  const migrationsDest = join(schemaRefDir, "migrations");
  if (existsSync(migrationsSrc)) {
    cpSync(migrationsSrc, migrationsDest, { recursive: true });
  }

  const policiesSql = join(PROJECT_ROOT, "supabase", "add-admin-staff-policies.sql");
  if (existsSync(policiesSql)) {
    cpSync(policiesSql, join(schemaRefDir, "add-admin-staff-policies.sql"));
  }
}

function writeRestoreGuide(destDir, manifest) {
  const content = `# ST-AMS backup – visszaállítási útmutató

Mentés készült: ${manifest.createdAt}
Git commit (kód): ${manifest.gitCommit ?? "ismeretlen"}
Supabase project ref: ${manifest.supabaseProjectRef ?? "ismeretlen"}

## Mit tartalmaz ez a backup?

- \`database/data/*.json\` – összes public tábla adata
- \`database/schema-reference/\` – séma + migrációk (GitHub commit: ${manifest.gitCommit ?? "lásd manifest"})
- \`auth/users.json\` – Supabase Auth felhasználók
- \`storage/<bucket>/\` – feltöltött fájlok (képek, csatolmányok)
- \`secrets/env-reference.txt\` – környezeti változók (érzékeny – ne oszd meg)
- \`manifest.json\` – összefoglaló

## Visszaállítás (új Supabase projekt)

1. Hozz létre új projektet a [Supabase Dashboard](https://supabase.com/dashboard)-on.
2. Futtasd a \`database/schema-reference/migrations/\` fájlokat **sorrendben** az SQL Editorban
   (vagy checkoutold a GitHub repót commit \`${manifest.gitCommit ?? "…"}\`-ra és futtasd a migrációkat).
3. Importáld az adatokat:
   - Supabase Table Editor → Import JSON, vagy
   - írj egy import scriptet a \`database/data/*.json\` fájlokból (FK sorrend: users/profiles először).
4. Auth: \`auth/users.json\` – újra létrehozás Admin API-val vagy manuális invite;
   jelszavak hash-elve vannak, teljes auth visszaállításhoz Supabase auth import szükséges.
5. Storage: hozd létre a bucket-eket (\`manifest.json\` → \`storage.buckets\`), majd töltsd fel a \`storage/\` mappából.
6. Állítsd be a \`secrets/env-reference.txt\` értékeit az új projekthez (.env.local + Vercel env).
7. Deploy: GitHub \`st-app\` repo, commit \`${manifest.gitCommit ?? "aktuális"}\`, Vercel env beállítás.

## Megjegyzés

Ez a backup a service role API-n keresztül készült (nem pg_dump).
A séma a migrációkból állítható vissza; az adatok JSON formátumban vannak.
`;

  writeFileSync(join(destDir, "RESTORE.md"), content, "utf8");
}

function writeEnvReference(destDir, env) {
  const secretsDir = join(destDir, "secrets");
  mkdirSync(secretsDir, { recursive: true });
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "IMMUTABLE_ADMIN_EMAIL",
    "KIOSK_PIN",
  ];
  const lines = [
    "# ST-AMS environment reference (CONFIDENTIAL)",
    `# Backup: ${new Date().toISOString()}`,
    "",
    "Állítsd be ezeket az új .env.local és Vercel Environment Variables részen.",
    "",
  ];
  for (const key of keys) {
    if (env[key]) lines.push(`${key}=${env[key]}`);
  }
  writeFileSync(join(secretsDir, "env-reference.txt"), lines.join("\n") + "\n", "utf8");
}

function dirSizeBytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) total += dirSizeBytes(full);
    else total += statSync(full).size;
  }
  return total;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local");
  }

  const outArgIdx = process.argv.indexOf("--out");
  const outBase =
    outArgIdx !== -1 && process.argv[outArgIdx + 1]
      ? resolve(process.argv[outArgIdx + 1])
      : join(process.env.USERPROFILE || process.env.HOME || ".", "Desktop");

  const stamp = todayStamp();
  const folderName = `st-ams-backup-${stamp}`;
  const backupDir = join(outBase, folderName);
  const zipPath = join(outBase, `${folderName}.zip`);

  if (existsSync(backupDir)) rmSync(backupDir, { recursive: true, force: true });
  if (existsSync(zipPath)) rmSync(zipPath, { force: true });

  mkdirSync(join(backupDir, "database", "data"), { recursive: true });
  mkdirSync(join(backupDir, "auth"), { recursive: true });
  mkdirSync(join(backupDir, "storage"), { recursive: true });

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("ST-AMS backup started…");
  console.log(`Output folder: ${backupDir}`);

  copySchemaReference(backupDir);
  console.log("✓ Schema reference copied");

  const tableStats = {};
  for (const table of PUBLIC_TABLES) {
    process.stdout.write(`  DB: ${table}… `);
    const { skipped, reason, rows } = await fetchAllRows(supabase, table);
    if (skipped) {
      console.log(`skipped (${reason})`);
      tableStats[table] = { rows: 0, skipped: true, reason };
      continue;
    }
    writeFileSync(
      join(backupDir, "database", "data", `${table}.json`),
      JSON.stringify(rows, null, 2),
      "utf8"
    );
    tableStats[table] = { rows: rows.length, skipped: false };
    console.log(`${rows.length} rows`);
  }

  console.log("  Auth users…");
  const authUsers = await fetchAllAuthUsers(supabase);
  writeFileSync(
    join(backupDir, "auth", "users.json"),
    JSON.stringify(authUsers, null, 2),
    "utf8"
  );
  console.log(`✓ Auth: ${authUsers.length} users`);

  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) throw new Error(`listBuckets: ${bucketsError.message}`);

  const storageStats = {};
  for (const bucket of buckets ?? []) {
    const bucketName = bucket.name;
    process.stdout.write(`  Storage: ${bucketName}… `);
    const paths = await listStoragePaths(supabase, bucketName);
    let downloaded = 0;
    for (const filePath of paths) {
      const dest = join(backupDir, "storage", bucketName, filePath);
      await downloadStorageFile(supabase, bucketName, filePath, dest);
      downloaded += 1;
    }
    storageStats[bucketName] = { files: downloaded, public: bucket.public ?? false };
    console.log(`${downloaded} files`);
  }

  writeEnvReference(backupDir, env);

  const manifest = {
    app: "st-ams",
    createdAt: new Date().toISOString(),
    gitCommit: getGitCommit(),
    supabaseProjectRef: getProjectRef(url),
    supabaseUrl: url,
    tables: tableStats,
    authUsers: authUsers.length,
    storage: {
      buckets: storageStats,
    },
    restoreHint: "See RESTORE.md",
  };
  writeFileSync(join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  writeRestoreGuide(backupDir, manifest);

  const folderSize = dirSizeBytes(backupDir);
  console.log(`\nBackup folder size: ${formatBytes(folderSize)}`);
  console.log("Creating ZIP…");

  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${backupDir.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force"`,
    { stdio: "inherit" }
  );

  const zipSize = statSync(zipPath).size;
  console.log(`\nDone.`);
  console.log(`Folder: ${backupDir}`);
  console.log(`ZIP:    ${zipPath} (${formatBytes(zipSize)})`);
}

main().catch((err) => {
  console.error("\nBackup failed:", err.message || err);
  process.exit(1);
});
