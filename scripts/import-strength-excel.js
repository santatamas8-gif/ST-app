/**
 * Import strength data from Strength-Card-Builder-Aleksa.xlsm into Supabase.
 *
 * Usage:
 *   node scripts/import-strength-excel.js "path/to/Strength-Card-Builder-Aleksa.xlsm"
 */

const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

function str(v) {
  return v == null ? "" : String(v).trim();
}
function num(v, fallback = 0) {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function parseSetNumber(setLabel) {
  const s = str(setLabel);
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}
function normalizeExcelPercentage(value) {
  const n = num(value, NaN);
  if (!Number.isFinite(n)) return 0;
  if (n > 0 && n <= 1) return Math.round(n * 1000) / 10;
  return n;
}

function parseExercises(wb, XLSX) {
  const sheet = wb.Sheets["Exercises"];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" })
    .filter((r) => str(r.Name))
    .map((r) => ({
      name: str(r.Name),
      category: str(r.Category),
      percent: r["%"] === "" || r["%"] == null ? 0 : num(r["%"]),
      related_to: str(r["Related to"]),
      percent_bw_used: num(r["%BW used"]),
      equipment_used: str(r["Equipment used"]),
      rounding: num(r.Rounding, 2.5) || 2.5,
      note: str(r.Note),
      video_url: str(r.__EMPTY_1) || null,
      image_url: str(r.__EMPTY) || null,
      active: true,
    }));
}

function parseSchemes(wb, XLSX) {
  const sheet = wb.Sheets["Set & Reps Schemes"];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const schemes = [];
  let current = null;
  for (const r of rows) {
    const schemeName = str(r["Set & Rep Scheme Name"]);
    if (schemeName) {
      if (current && current.items.length) schemes.push(current);
      current = {
        name: schemeName,
        category: str(r.Category),
        description: str(r.Description),
        source_excel_name: schemeName,
        items: [],
      };
      continue;
    }
    if (!current) continue;
    const setNum = parseSetNumber(r.Set);
    const pct = r["Week 1"];
    const reps = r.__EMPTY;
    if (setNum == null || pct === "" || pct == null) continue;
    const percentage = normalizeExcelPercentage(pct);
    const repCount = num(reps, 0);
    if (percentage <= 0 || repCount <= 0) continue;
    current.items.push({ set_number: setNum, percentage, reps: repCount, week_number: 1 });
  }
  if (current && current.items.length) schemes.push(current);
  const seen = new Set();
  return schemes.filter((s) => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return s.items.length > 0 && s.items.length <= 10;
  });
}

async function insertSchemesBatch(supabase, schemes) {
  const BATCH = 40;
  for (let i = 0; i < schemes.length; i += BATCH) {
    const batch = schemes.slice(i, i + BATCH);
    const { data: inserted, error } = await supabase
      .from("strength_set_rep_schemes")
      .insert(batch.map(({ items, ...meta }) => meta))
      .select("id");
    if (error) throw error;
    const allItems = [];
    batch.forEach((scheme, idx) => {
      const schemeId = inserted[idx]?.id;
      if (!schemeId) return;
      for (const it of scheme.items) {
        allItems.push({ ...it, scheme_id: schemeId });
      }
    });
    if (allItems.length) {
      const { error: itemsErr } = await supabase.from("strength_set_rep_scheme_items").insert(allItems);
      if (itemsErr) throw itemsErr;
    }
  }
}

async function main() {
  loadEnv();
  const filePath = process.argv[2];
  if (!filePath || !fs.existsSync(filePath)) {
    console.error("Usage: node scripts/import-strength-excel.js <path-to-xlsm>");
    process.exit(1);
  }

  const XLSX = require("xlsx");
  const { createClient } = require("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const exercises = parseExercises(wb, XLSX);
  const schemes = parseSchemes(wb, XLSX);

  console.log(`Parsed ${exercises.length} exercises, ${schemes.length} schemes`);

  await supabase.from("strength_set_rep_scheme_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("strength_set_rep_schemes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("strength_exercises").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const { error: exErr } = await supabase.from("strength_exercises").insert(exercises);
  if (exErr) {
    console.error("Exercise import failed:", exErr.message);
    process.exit(1);
  }

  if (schemes.length) await insertSchemesBatch(supabase, schemes);

  console.log("Import complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
