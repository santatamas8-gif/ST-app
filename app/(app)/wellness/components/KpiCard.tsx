"use client";

import type { ReactNode } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";

const CARD_RADIUS = "12px";

interface KpiCardProps {
  label: ReactNode;
  value: ReactNode;
  sublabel?: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function KpiCard({ label, value, sublabel, className = "", onClick }: KpiCardProps) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const content = (
    <>
      <p className={`text-sm font-medium ${isHighContrast ? "text-white/90" : "text-zinc-400"}`}>{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-white">{value}</p>
      {sublabel != null && <p className={`mt-1 text-xs ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>{sublabel}</p>}
    </>
  );
  const wrapperClass = `rounded-xl p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-[var(--card-shadow-hover)] ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""} ${className}`.trim();
  const style =
    themeId === "neon"
      ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
      : themeId === "matt"
        ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
        : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS, boxShadow: "var(--card-shadow)" };
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
