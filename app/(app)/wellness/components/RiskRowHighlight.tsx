"use client";

import type { ReactNode } from "react";

interface RiskRowHighlightProps {
  isAtRisk: boolean;
  children: ReactNode;
  className?: string;
}

export function RiskRowHighlight({ isAtRisk, children, className = "" }: RiskRowHighlightProps) {
  return (
    <tr
      className={`border-b border-zinc-800 transition-colors hover:bg-zinc-800/50 ${className}`}
      style={isAtRisk ? { backgroundColor: "rgba(239, 68, 68, 0.08)" } : undefined}
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
