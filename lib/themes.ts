export type ThemeId = "dark" | "light" | "red" | "blue" | "green";

export const THEMES: {
  id: ThemeId;
  name: string;
  pageBg: string;
  cardBg: string;
  cardBorder: string;
  /** Text color – light on dark themes, dark on light theme */
  foreground: string;
}[] = [
  {
    id: "dark",
    name: "Dark",
    pageBg: "#0f1216",
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
];

export function getThemeById(id: string | null): (typeof THEMES)[0] {
  const t = THEMES.find((x) => x.id === id);
  return t ?? THEMES[0];
}

export const THEME_STORAGE_KEY = "app-theme";
