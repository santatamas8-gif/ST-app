export type ThemeId = "dark" | "light" | "red" | "blue" | "green" | "neon" | "matt";

export const THEMES: {
  id: ThemeId;
  name: string;
  pageBg: string;
  cardBg: string;
  cardBorder: string;
  /** Text color – light on dark themes, dark on light theme */
  foreground: string;
}[] = [
  /* Default theme for all roles (player, admin, staff) on desktop and mobile. Users can change via Theme in sidebar. */
  {
    id: "dark",
    name: "Dark",
    pageBg: "#1a1a1a",
    cardBg: "#181d24",
    cardBorder: "#2d3239",
    foreground: "#fafafa",
  },
  {
    id: "light",
    name: "Light",
    pageBg: "#f4f4f5",
    cardBg: "#ffffff",
    cardBorder: "#e4e4e7",
    foreground: "#18181b",
  },
  {
    id: "red",
    name: "Red",
    pageBg: "#1f1315",
    cardBg: "#2d1f21",
    cardBorder: "#4a2c2e",
    foreground: "#fef2f2",
  },
  {
    id: "blue",
    name: "Blue",
    pageBg: "#0f172a",
    cardBg: "#1e293b",
    cardBorder: "#334155",
    foreground: "#f8fafc",
  },
  {
    id: "green",
    name: "Green",
    pageBg: "#0f2621",
    cardBg: "#174236",
    cardBorder: "#1e4d42",
    foreground: "#f0fdf4",
  },
  {
    id: "neon",
    name: "Neon",
    pageBg: "#13171c",
    cardBg: "#181d24",
    cardBorder: "#2d3239",
    foreground: "#fafafa",
  },
  {
    id: "matt",
    name: "Matt black",
    pageBg: "#0e0e12",
    cardBg: "#14141c",
    cardBorder: "#2e2e36",
    foreground: "#fafafa",
  },
];

export function getThemeById(id: string | null): (typeof THEMES)[0] {
  const t = THEMES.find((x) => x.id === id);
  return t ?? THEMES[0];
}

export const THEME_STORAGE_KEY = "app-theme";

/** Neon theme: less green + subtle glow (use when themeId === "neon") */
export const NEON_CARD_STYLE = {
  backgroundImage:
    "radial-gradient(circle at left, rgba(16, 185, 129, 0.26) 0, transparent 55%), linear-gradient(135deg, #041311, #020617)",
  boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 0 1px rgba(16, 185, 129, 0.2), 0 5px 16px rgba(6, 95, 70, 0.08)",
};

/** Status-specific neon card: the given status color dominates (background + glow). Use for player cards, at-risk panels, etc. */
export type NeonStatusKey = "available" | "limited" | "unavailable" | "injured" | "rehab";

/** Softer green for "available" – less green, minimal glow. */
const AVAILABLE_SOFT = {
  backgroundImage:
    "radial-gradient(circle at left, rgba(16, 185, 129, 0.2) 0, transparent 55%), linear-gradient(135deg, #051513, #020617)",
  boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 0 1px rgba(16, 185, 129, 0.18), 0 4px 14px rgba(6, 95, 70, 0.06)",
};

const NEON_STATUS_STYLES: Record<
  NeonStatusKey,
  { backgroundImage: string; boxShadow: string }
> = {
  available: AVAILABLE_SOFT,
  injured: {
    backgroundImage:
      "radial-gradient(circle at left, rgba(239, 68, 68, 0.28) 0, transparent 55%), linear-gradient(135deg, #0f0606, #0a0202)",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 0 1px rgba(239, 68, 68, 0.2), 0 5px 16px rgba(127, 29, 29, 0.08)",
  },
  rehab: {
    backgroundImage:
      "radial-gradient(circle at left, rgba(14, 165, 233, 0.28) 0, transparent 55%), linear-gradient(135deg, #060d14, #020617)",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 0 1px rgba(14, 165, 233, 0.2), 0 5px 16px rgba(12, 74, 110, 0.08)",
  },
  limited: {
    backgroundImage:
      "radial-gradient(circle at left, rgba(245, 158, 11, 0.28) 0, transparent 55%), linear-gradient(135deg, #121004, #0a0802)",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 0 1px rgba(245, 158, 11, 0.2), 0 5px 16px rgba(120, 53, 15, 0.08)",
  },
  unavailable: {
    backgroundImage:
      "radial-gradient(circle at left, rgba(249, 115, 22, 0.28) 0, transparent 55%), linear-gradient(135deg, #110c04, #0a0502)",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 0 1px rgba(249, 115, 22, 0.2), 0 5px 16px rgba(124, 45, 18, 0.08)",
  },
};

export function getNeonCardStyleForStatus(
  status: string
): { backgroundImage: string; boxShadow: string } {
  const key = status as NeonStatusKey;
  return NEON_STATUS_STYLES[key] ?? NEON_CARD_STYLE;
}

/** Matt theme: black/white/gray like neon but no color. A bit more white glow + shadow so text stays readable. */
export const MATT_CARD_STYLE = {
  backgroundImage:
    "radial-gradient(circle at left, rgba(255,255,255,0.32) 0, transparent 50%), linear-gradient(145deg, #1e1e26 0%, #16161a 50%, #101014 100%)",
  boxShadow:
    "0 0 0 1px rgba(255,255,255,0.32), 0 0 28px rgba(255,255,255,0.12), 0 8px 32px rgba(0,0,0,0.45), 0 20px 50px rgba(0,0,0,0.22)",
};

/** Matt theme: same status gradient but minimal glow (no strong colored glow on cards). */
const MATT_STATUS_SHADOW = "0 0 0 1px rgba(255,255,255,0.2), 0 6px 20px rgba(0,0,0,0.4)";

/** Status-based card style for both neon and matt. Matt = same colors, much less glow on player cards. */
export function getStatusCardStyle(
  themeId: string,
  status: string
): { background?: string; backgroundImage?: string; boxShadow: string } {
  const base = status === "available" ? AVAILABLE_SOFT : getNeonCardStyleForStatus(status);
  if (themeId === "matt") {
    return { backgroundImage: base.backgroundImage, boxShadow: MATT_STATUS_SHADOW };
  }
  return { ...base };
}
