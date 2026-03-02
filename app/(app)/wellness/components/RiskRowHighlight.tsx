"use client";

import type { ReactNode } from "react";

interface RiskRowHighlightProps {
  isAtRisk: boolean;
  children: ReactNode;
  className?: string;
  /** For zebra striping: even = 0, odd = 1. Only used when !isAtRisk. */
  rowIndex?: number;
}

export function RiskRowHighlight({ isAtRisk, children, className = "", rowIndex = 0 }: RiskRowHighlightProps) {
  const rowStyle = isAtRisk
    ? { backgroundColor: "rgba(239, 68, 68, 0.12)" }
    : undefined;
  const zebraClass = !isAtRisk && rowIndex % 2 === 1 ? "bg-zinc-800/40" : "";
  return (
    <tr
      className={`border-b border-zinc-800 transition-colors hover:bg-zinc-800/50 ${zebraClass} ${className}`}
      style={rowStyle}
    >
      {children}
    </tr>
  );
}

export function RiskBadge() {
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-red-500/25 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-red-400">
      Risk
    </span>
  );
}
