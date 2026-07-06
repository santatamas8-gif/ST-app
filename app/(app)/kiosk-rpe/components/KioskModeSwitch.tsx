"use client";

import { Activity, HeartPulse } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export type KioskMode = "rpe" | "wellness";

type KioskModeSwitchProps = {
  mode: KioskMode;
  onChange: (mode: KioskMode) => void;
  disabled?: boolean;
};

const MODES: { id: KioskMode; label: string; icon: typeof Activity }[] = [
  { id: "rpe", label: "RPE", icon: Activity },
  { id: "wellness", label: "Wellness", icon: HeartPulse },
];

export function KioskModeSwitch({ mode, onChange, disabled = false }: KioskModeSwitchProps) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";

  return (
    <div
      className="inline-flex w-full max-w-md rounded-xl border p-1 sm:w-auto"
      style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
      role="tablist"
      aria-label="Kiosk mode"
    >
      {MODES.map(({ id, label, icon: Icon }) => {
        const selected = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onChange(id)}
            className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors sm:min-w-[8.5rem] ${
              selected
                ? "bg-emerald-600 text-white shadow-sm"
                : isHighContrast
                  ? "text-white/80 hover:bg-white/10"
                  : "text-zinc-400 hover:bg-zinc-800/80 hover:text-white"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
