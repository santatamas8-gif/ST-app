import type { WorkBook } from "xlsx";

export type ParsedExercise = {
  name: string;
  category: string;
  percent: number;
  related_to: string;
  percent_bw_used: number;
  equipment_used: string;
  rounding: number;
  note: string;
  video_url: string | null;
  image_url: string | null;
  active: boolean;
};

export type ParsedSchemeItem = {
  set_number: number;
  percentage: number;
  reps: number;
  week_number: number | null;
};

export type ParsedScheme = {
  name: string;
  category: string;
  description: string;
  source_excel_name: string;
  items: ParsedSchemeItem[];
};

export type ParsedAthlete = {
  name: string;
  bodyweight: number | null;
  squat: number | null;
  bench_press: number | null;
  deadlift: number | null;
  pull_up: number | null;
  military_press: number | null;
  clean: number | null;
  snatch: number | null;
};

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function num(v: unknown, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseSetNumber(setLabel: unknown): number | null {
  const s = str(setLabel);
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Percent from Excel may be 0.72 or 72 */
export function normalizeExcelPercentage(value: unknown): number {
  const n = num(value, NaN);
  if (!Number.isFinite(n)) return 0;
  if (n > 0 && n <= 1) return Math.round(n * 1000) / 10;
  return n;
}

export function parseExercisesFromWorkbook(wb: WorkBook, XLSX: typeof import("xlsx")): ParsedExercise[] {
  const sheet = wb.Sheets["Exercises"] ?? wb.Sheets["Exercise"];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return rows
    .filter((r) => str(r.Name || r.Exercise))
    .map((r) => {
      const pctRaw = r["%"] ?? r.Percent ?? r.Coefficient;
      const pct = pctRaw === "" || pctRaw == null ? 0 : num(pctRaw, 0);
      const video =
        str(r["Video URL"] ?? r.Video ?? r.__EMPTY_1 ?? "") || null;
      const image = str(r["Image URL"] ?? r.Image ?? r.__EMPTY ?? "") || null;

      return {
        name: str(r.Name || r.Exercise),
        category: str(r.Category || r.Type),
        percent: pct,
        related_to: str(r["Related to"] ?? r.Related ?? r.Reference),
        percent_bw_used: num(r["%BW used"] ?? r["Percent BW"] ?? 0),
        equipment_used: str(r["Equipment used"] ?? r.Equipment),
        rounding: num(r.Rounding ?? r.Round, 2.5) || 2.5,
        note: str(r.Note ?? r.Notes),
        video_url: video,
        image_url: image,
        active: true,
      };
    });
}

/**
 * Parse Set & Reps Schemes sheet.
 * For daily cards we import Week 1 columns by default (week_number = 1).
 */
export function parseSchemesFromWorkbook(
  wb: WorkBook,
  XLSX: typeof import("xlsx"),
  weekNumber = 1
): ParsedScheme[] {
  const sheet =
    wb.Sheets["Set & Reps Schemes"] ??
    wb.Sheets["Set and Reps Schemes"] ??
    wb.Sheets["Schemes"];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const weekPctKey = weekNumber === 1 ? "Week 1" : `Week ${weekNumber}`;
  const weekRepsKey =
    weekNumber === 1 ? "__EMPTY" : `__EMPTY${weekNumber > 1 ? `_${weekNumber - 1}` : ""}`;

  const schemes: ParsedScheme[] = [];
  let current: ParsedScheme | null = null;

  for (const r of rows) {
    const schemeName = str(r["Set & Rep Scheme Name"] ?? r.Name ?? r.Scheme);
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

    const setNum = parseSetNumber(r.Set ?? r["Set #"]);
    const pct = r[weekPctKey];
    const reps = r[weekRepsKey];

    if (setNum == null || pct === "" || pct == null) continue;

    const percentage = normalizeExcelPercentage(pct);
    const repCount = num(reps, 0);
    if (percentage <= 0 || repCount <= 0) continue;

    current.items.push({
      set_number: setNum,
      percentage,
      reps: repCount,
      week_number: weekNumber,
    });
  }

  if (current && current.items.length) schemes.push(current);

  return schemes.filter((s) => s.items.length > 0);
}

export function parseAthletesFromWorkbook(wb: WorkBook, XLSX: typeof import("xlsx")): ParsedAthlete[] {
  const sheet = wb.Sheets["Athletes"] ?? wb.Sheets["Players"];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return rows
    .filter((r) => str(r.Name) && str(r.Active).toLowerCase() !== "no")
    .map((r) => ({
      name: str(r.Name),
      bodyweight: num(r.BW, NaN) || null,
      squat: num(r.Squat, NaN) || null,
      bench_press: num(r["Bench Press"] ?? r.Bench, NaN) || null,
      deadlift: num(r.Deadlift, NaN) || null,
      pull_up: num(r["Pull-Up"] ?? r["Pull Up"], NaN) || null,
      military_press: num(r["Military Press"], NaN) || null,
      clean: num(r.Clean, NaN) || null,
      snatch: num(r.Snatch, NaN) || null,
    }));
}

/** Schemes suitable for daily builder: dedupe by name, keep Week 1 sets only, limit set count. */
export function dailySchemesFromParsed(schemes: ParsedScheme[]): ParsedScheme[] {
  const seen = new Set<string>();
  const result: ParsedScheme[] = [];

  for (const s of schemes) {
    if (seen.has(s.name)) continue;
    seen.add(s.name);
    const items = [...s.items]
      .filter((it) => it.week_number === 1 || it.week_number == null)
      .sort((a, b) => a.set_number - b.set_number);
    if (items.length === 0 || items.length > 10) continue;
    result.push({ ...s, items });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}
