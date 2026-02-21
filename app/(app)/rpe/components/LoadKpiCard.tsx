"use client";

import type { ReactNode } from "react";

const BG_CARD = "#11161c";
const CARD_RADIUS = "12px";

type Status = "normal" | "warning" | "danger";

const statusStyles: Record<Status, string> = {
  normal: "text-emerald-400",
  warning: "text-amber-400",
  danger: "text-red-400",
};

interface LoadKpiCardProps {
  label: string;
  value: ReactNode;
  status?: Status;
  sublabel?: string;
  className?: string;
}

export function LoadKpiCard({
  label,
  value,
  status = "normal",
  sublabel,
  className = "",
}: LoadKpiCardProps) {
  const valueColor = statusStyles[status];
  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
    >
      <p className="text-sm font-medium text-zinc-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${valueColor}`}>{value}</p>
      {sublabel != null && <p className="mt-1 text-xs text-zinc-500">{sublabel}</p>}
    </div>
  );
}
