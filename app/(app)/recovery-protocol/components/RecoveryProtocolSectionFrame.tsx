"use client";

import type { ReactNode } from "react";
import { useTheme } from "@/components/ThemeProvider";

/** Theme-aware card frame; gaps between frames show page background. */
export function RecoveryProtocolSectionFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { themeId } = useTheme();

  const frameClass =
    themeId === "neon"
      ? "overflow-hidden rounded-xl border border-emerald-500/30 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.28)] ring-1 ring-emerald-500/15"
      : themeId === "matt"
        ? "overflow-hidden rounded-xl border border-white/20 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.4)] ring-1 ring-white/10"
        : "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100";

  return <div className={`${frameClass} ${className}`.trim()}>{children}</div>;
}
