export type ThemeId = "black" | "green" | "navy" | "brown" | "purple";

export const THEMES: {
  id: ThemeId;
  name: string;
  pageBg: string;
  cardBg: string;
  cardBorder: string;
}[] = [
  { id: "black", name: "Black", pageBg: "#0b0f14", cardBg: "#11161c", cardBorder: "#27272a" },
  { id: "green", name: "Dark green", pageBg: "#0f2621", cardBg: "#174236", cardBorder: "#1e4d42" },
  { id: "navy", name: "Navy", pageBg: "#131d33", cardBg: "#253347", cardBorder: "#2d3d5a" },
  { id: "brown", name: "Dark brown", pageBg: "#221f1d", cardBg: "#373432", cardBorder: "#454340" },
  { id: "purple", name: "Dark purple", pageBg: "#252242", cardBg: "#383552", cardBorder: "#454366" },
];

export function getThemeById(id: string | null): (typeof THEMES)[0] {
  const t = THEMES.find((x) => x.id === id);
  return t ?? THEMES[0];
}

export const THEME_STORAGE_KEY = "app-theme";
