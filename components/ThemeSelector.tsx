"use client";

import { useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { THEMES, type ThemeId } from "@/lib/themes";

const SWATCH: Record<ThemeId, string> = {
  black: "#0b0f14",
  green: "#0d1f1a",
  navy: "#0f172a",
  brown: "#1c1917",
  purple: "#1e1b2e",
};

export function ThemeSelector() {
  const { themeId, setThemeId } = useTheme();
  const [open, setOpen] = useState(false);
  const themeLabelClass =
    themeId === "black"
      ? "text-zinc-500 hover:text-zinc-400"
      : "text-zinc-400 hover:text-zinc-300";

  return (
    <div
      className="group border-t border-zinc-800 p-3"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full px-3 py-2 text-left text-xs font-medium ${themeLabelClass}`}
      >
        Theme
      </button>
      <div className={`mt-2 flex flex-wrap gap-2 ${open ? "" : "hidden group-hover:flex"}`}>
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setThemeId(t.id);
              setOpen(false);
            }}
            title={t.name}
            className={`h-8 w-8 rounded-lg border-2 transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
              themeId === t.id ? "border-emerald-400 ring-2 ring-emerald-400/30" : "border-zinc-600 hover:border-zinc-500"
            }`}
            style={{ backgroundColor: SWATCH[t.id] }}
            aria-label={t.name}
          />
        ))}
      </div>
    </div>
  );
}
