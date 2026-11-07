/** Power BI integer format: half away from zero. GPS metrics here are non-negative. */
export function roundPowerBi0(value: number): number {
  if (!Number.isFinite(value)) return Number.NaN;
  return Math.round(value);
}

export function formatDrillMetric(value: number | null, unit: "m" | "count"): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const rounded = roundPowerBi0(value);
  if (!Number.isFinite(rounded)) return "—";
  return unit === "m" ? `${rounded} m` : String(rounded);
}

/**
 * Difference of the two values after the same rounding the sheet displays.
 * Missing on either side stays blank. A source zero is a real zero.
 */
export function formatMetricDifference(a: number | null, b: number | null, unit: "m" | "count"): string {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return "—";
  const left = roundPowerBi0(a);
  const right = roundPowerBi0(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return "—";
  const delta = left - right;
  if (delta === 0) return "0";
  const sign = delta > 0 ? "+" : "−";
  const amount = Math.abs(delta);
  return unit === "m" ? `${sign}${amount} m` : `${sign}${amount}`;
}

export function formatDrillNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const rounded = roundPowerBi0(value);
  if (!Number.isFinite(rounded)) return "—";
  return String(rounded);
}

export type ReportHeadings = {
  title: string;
  setCountLabel: string;
  columnLabels: string[];
};

/** Display-only. Does not rewrite stored or source drill names. */
export function reportHeadings(displayName: string, labels: string[]): ReportHeadings {
  const count = labels.length;
  const setCountLabel = `${count} ${count === 1 ? "set" : "sets"}`;
  const parsed = labels.map(splitSetSuffix);
  const bases = parsed.map((item) => item.base);
  const sharedBase = collapseSpaces(bases[0] ?? "");
  const sameNamedSets =
    labels.length > 1 &&
    parsed.every((item) => item.setToken) &&
    sharedBase.length > 0 &&
    bases.every((base) => collapseSpaces(base) === sharedBase);
  if (sameNamedSets) {
    return {
      title: displayName.trim() || sharedBase,
      setCountLabel,
      columnLabels: parsed.map((item) => item.setToken ?? ""),
    };
  }
  if (labels.length <= 1) {
    return {
      title: displayName.trim() || labels[0] || "Drill",
      setCountLabel,
      columnLabels: labels.map(() => ""),
    };
  }
  return {
    title: displayName.trim(),
    setCountLabel,
    columnLabels: [...labels],
  };
}

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitSetSuffix(label: string): { base: string; setToken: string | null } {
  const match = /^(.*?)(?:\s*[-–—]\s*)SET\s*(\d+)\s*$/i.exec(label.trim());
  if (!match) return { base: label.trim(), setToken: null };
  const base = match[1].replace(/[\s\-–—]+$/, "").trim();
  if (!base) return { base: label.trim(), setToken: null };
  return { base, setToken: `SET${match[2]}` };
}

/** Whole minutes. 30 seconds and above round up; under 30 round down. */
export function roundDurationToMinutes(seconds: number): number | null {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const wholeMinutes = Math.floor(seconds / 60);
  const remainderSeconds = seconds - wholeMinutes * 60;
  return remainderSeconds >= 30 ? wholeMinutes + 1 : wholeMinutes;
}

/**
 * The minute most players recorded. Does not average.
 * A shorter or longer outlier does not hide the drill length.
 * An equal count uses the longer minute.
 */
export function modalDurationMinutes(values: Array<number | null>): number | null {
  const counts = new Map<number, number>();
  for (const seconds of values) {
    if (seconds === null) continue;
    const minutes = roundDurationToMinutes(seconds);
    if (minutes === null) continue;
    counts.set(minutes, (counts.get(minutes) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [minutes, count] of counts) {
    if (count > bestCount || (count === bestCount && (best === null || minutes > best))) {
      best = minutes;
      bestCount = count;
    }
  }
  return best;
}

export function formatDurationMinutes(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  return `${minutes} min`;
}

export function formatSessionDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(match[2]) - 1];
  if (!month) return isoDate;
  return `${Number(match[3])} ${month} ${match[1]}`;
}
