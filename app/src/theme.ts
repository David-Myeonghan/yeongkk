// 색은 web/src/styles/theme.css.ts 의 토큰 값을 그대로 옮긴 것이다.
export const THEME = {
  light: { background: "#f5f4fa", text: "#17142a", accent: "#5432e6", onAccent: "#ffffff" },
  dark: { background: "#15131d", text: "#f2f0f9", accent: "#a897ff", onAccent: "#15131d" },
} as const;

export type Palette = (typeof THEME)[keyof typeof THEME];

export const paletteFor = (scheme: string | null | undefined): Palette => (scheme === "dark" ? THEME.dark : THEME.light);
