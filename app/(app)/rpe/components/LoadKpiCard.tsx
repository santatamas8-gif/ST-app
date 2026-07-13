"use client";

import type { ReactNode } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";

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
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const valueColor = statusStyles[status];
  return (
    <div
      className={`rounded-xl p-4 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""} ${className}`}
      style={{
        borderRadius: CARD_RADIUS,
        ...(themeId === "neon" ? NEON_CARD_STYLE : themeId === "matt" ? MATT_CARD_STYLE : { backgroundColor: "var(--card-bg)" }),
      }}
    >
      <p className={`text-sm font-medium ${isHighContrast ? "text-white/90" : "text-zinc-400"}`}>{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${valueColor}`}>{value}</p>
      {sublabel != null && (
        <p className={`mt-1 text-xs ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>{sublabel}</p>
      )}
    </div>
  );
}
