/** Pure helpers for Power BI Execute Queries row parsing (safe for unit tests). */

export function escapeDaxString(value: string): string {
  return value.replace(/"/g, '""');
}

/**
 * Read a column from an Execute Queries row.
 * Keys may appear as `TD`, `[TD]`, or `GPS_Log[TD]`.
 */
export function pickRowValue(row: Record<string, unknown>, column: string): unknown {
  if (Object.prototype.hasOwnProperty.call(row, column)) return row[column];
  const bracket = `[${column}]`;
  if (Object.prototype.hasOwnProperty.call(row, bracket)) return row[bracket];
  const suffix = Object.keys(row).find(
    (key) => key.endsWith(bracket) || key.endsWith(`.${column}`)
  );
  return suffix ? row[suffix] : undefined;
}

export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Parse `YYYY-MM-DD` (optional time suffix ignored). */
export function parseIsoDateParts(
  date: string
): { year: number; month: number; day: number } | null {
  const trimmed = date.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return { year, month, day };
}

export function firstResultRows(
  results: { tables: { rows: Record<string, unknown>[] }[] }[]
): Record<string, unknown>[] {
  const table = results[0]?.tables?.[0];
  return table?.rows ?? [];
}
