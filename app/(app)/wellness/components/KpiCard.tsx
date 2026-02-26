"use client";

import type { ReactNode } from "react";

const CARD_RADIUS = "12px";

interface KpiCardProps {
  label: ReactNode;
  value: ReactNode;
  sublabel?: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function KpiCard({ label, value, sublabel, className = "", onClick }: KpiCardProps) {
  const content = (
    <>
      <p className="text-sm font-medium text-zinc-400">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-white">{value}</p>
      {sublabel != null && <p className="mt-1 text-xs text-zinc-500">{sublabel}</p>}
    </>
  );
  const wrapperClass = `rounded-xl p-4 ${className}`.trim();
  const style = { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS };
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`w-full text-left ${wrapperClass}`} style={style}>
        {content}
      </button>
    );
  }
  return (
    <div className={wrapperClass} style={style}>
      {content}
    </div>
  );
}
