"use client";

type RiskLevel = "normal" | "warning" | "danger";

const styles: Record<RiskLevel, string> = {
  normal: "bg-emerald-500/20 text-emerald-400",
  warning: "bg-amber-500/20 text-amber-400",
  danger: "bg-red-500/20 text-red-400",
};

interface RiskBadgeProps {
  level: RiskLevel;
  label?: string;
  className?: string;
}

export function RiskBadge({ level, label, className = "" }: RiskBadgeProps) {
  const display =
    label ??
    (level === "danger" ? "Risk" : level === "warning" ? "Warning" : "OK");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${styles[level]} ${className}`}
    >
      {display}
    </span>
  );
}

/** Load spike % → risk level: >30% danger, 20–30% warning, else normal */
export function spikeToRiskLevel(spikePercent: number | null): RiskLevel {
  if (spikePercent == null) return "normal";
  if (spikePercent >= 0.3) return "danger";
  if (spikePercent >= 0.2) return "warning";
  return "normal";
}
