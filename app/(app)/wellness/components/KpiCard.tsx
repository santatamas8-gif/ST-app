"use client";

import type { ReactNode } from "react";

const BG_CARD = "#11161c";
const CARD_RADIUS = "12px";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  sublabel?: string;
  className?: string;
}

export function KpiCard({ label, value, sublabel, className = "" }: KpiCardProps) {
  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
    >
      <p className="text-sm font-medium text-zinc-400">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-white">{value}</p>
      {sublabel != null && <p className="mt-1 text-xs text-zinc-500">{sublabel}</p>}
    </div>
  );
}
