export type HiitCatalogRow = {
  workSec: number;
  restSec: number;
  masMin: number;
  masMax: number;
  asrMin: number;
  asrMax: number;
  repsMin: number;
  repsMax: number;
  setsMin: number;
  setsMax: number;
  /** Last row on the sheet is written "~0–10%". */
  asrApprox?: boolean;
};

/** Recommended formats from the coach sheet. Bands are guidance; the coach picks one percent. */
export const HIIT_CATALOG: HiitCatalogRow[] = [
  { workSec: 10, restSec: 20, masMin: 115, masMax: 125, asrMin: 25, asrMax: 35, repsMin: 8, repsMax: 12, setsMin: 3, setsMax: 8 },
  { workSec: 15, restSec: 15, masMin: 125, masMax: 135, asrMin: 20, asrMax: 30, repsMin: 8, repsMax: 12, setsMin: 3, setsMax: 8 },
  { workSec: 15, restSec: 30, masMin: 110, masMax: 120, asrMin: 30, asrMax: 40, repsMin: 6, repsMax: 12, setsMin: 3, setsMax: 8 },
  { workSec: 20, restSec: 40, masMin: 105, masMax: 115, asrMin: 35, asrMax: 45, repsMin: 6, repsMax: 12, setsMin: 3, setsMax: 8 },
  { workSec: 10, restSec: 10, masMin: 130, masMax: 140, asrMin: 15, asrMax: 25, repsMin: 10, repsMax: 16, setsMin: 3, setsMax: 8 },
  { workSec: 20, restSec: 20, masMin: 120, masMax: 130, asrMin: 30, asrMax: 40, repsMin: 8, repsMax: 12, setsMin: 3, setsMax: 8 },
  { workSec: 30, restSec: 30, masMin: 90, masMax: 105, asrMin: 0, asrMax: 10, repsMin: 10, repsMax: 20, setsMin: 4, setsMax: 8 },
  { workSec: 20, restSec: 10, masMin: 135, masMax: 145, asrMin: 30, asrMax: 50, repsMin: 6, repsMax: 8, setsMin: 3, setsMax: 6 },
  { workSec: 30, restSec: 15, masMin: 105, masMax: 115, asrMin: 10, asrMax: 25, repsMin: 6, repsMax: 10, setsMin: 3, setsMax: 6 },
  { workSec: 60, restSec: 60, masMin: 100, masMax: 105, asrMin: 0, asrMax: 10, repsMin: 4, repsMax: 8, setsMin: 4, setsMax: 8, asrApprox: true },
];

export function formatBand(min: number, max: number, approx = false): string {
  const body = `${min}–${max}%`;
  return approx ? `~${body}` : body;
}

/** Same width for every band so the % lines up, and the block can sit in the center of the cell. */
export function centeredBand(min: number, max: number, approx = false, width = 9): string {
  return formatBand(min, max, approx).padStart(width, " ");
}

export function bandMidpoint(min: number, max: number): number {
  return Math.round((min + max) / 2);
}

export function catalogRowForWorkRest(workSec: number, restSec: number): HiitCatalogRow | null {
  return HIIT_CATALOG.find((row) => row.workSec === workSec && row.restSec === restSec) ?? null;
}
