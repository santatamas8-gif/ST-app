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

export function formatSessionDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(match[2]) - 1];
  if (!month) return isoDate;
  return `${Number(match[3])} ${month} ${match[1]}`;
}
