/**
 * Generate seed JSON from Strength-Card-Builder-Aleksa.xlsm
 * Usage: node scripts/generate-strength-seed.js "path/to/file.xlsm"
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

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

function parseExercises(wb) {
  const sheet = wb.Sheets["Exercises"];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows
    .filter((r) => str(r.Name))
    .map((r) => {
      const pctRaw = r["%"];
      const pct = pctRaw === "" || pctRaw == null ? 0 : num(pctRaw, 0);
      return {
        name: str(r.Name),
        category: str(r.Category),
        percent: pct,
        related_to: str(r["Related to"]),
        percent_bw_used: num(r["%BW used"]),
        equipment_used: str(r["Equipment used"]),
        rounding: num(r.Rounding, 2.5) || 2.5,
        note: str(r.Note),
        video_url: str(r.__EMPTY_1) || null,
        image_url: str(r.__EMPTY) || null,
        active: true,
      };
    });
}

function parseSchemes(wb) {
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
    current.items.push({
      set_number: setNum,
      percentage,
      reps: repCount,
      week_number: 1,
    });
  }
  if (current && current.items.length) schemes.push(current);

  const seen = new Set();
  return schemes
    .filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return s.items.length > 0 && s.items.length <= 10;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

const filePath = process.argv[2];
if (!filePath || !fs.existsSync(filePath)) {
  console.error("Usage: node scripts/generate-strength-seed.js <path-to-xlsm>");
  process.exit(1);
}

console.log("Reading", filePath);
const wb = XLSX.readFile(filePath, { cellDates: true });
const exercises = parseExercises(wb);
const schemes = parseSchemes(wb);
const outDir = path.join(__dirname, "..", "lib", "strength", "seed");
fs.writeFileSync(path.join(outDir, "exercises.json"), JSON.stringify(exercises, null, 2));
fs.writeFileSync(path.join(outDir, "schemes.json"), JSON.stringify(schemes, null, 2));
console.log(`Wrote ${exercises.length} exercises, ${schemes.length} schemes`);
