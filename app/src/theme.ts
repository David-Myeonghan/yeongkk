export const THEME = {
  light: { background: "#f5f4fa", text: "#1b1830", accent: "#5b4bd6", onAccent: "#ffffff" },
  dark: { background: "#15131d", text: "#ececf4", accent: "#9d90ff", onAccent: "#15131d" },
} as const;

export type Palette = (typeof THEME)[keyof typeof THEME];

export const paletteFor = (scheme: string | null | undefined): Palette => (scheme === "dark" ? THEME.dark : THEME.light);
