import { createGlobalTheme, globalStyle } from "@vanilla-extract/css";

export const vars = createGlobalTheme(":root", {
  color: {
    // index.html theme-color metas mirror background (light/dark)
    background: "#f5f4fa",
    surface: "#ffffff",
    sunken: "#ebe9f3",
    line: "#d9d5e8",
    text: "#17142a",
    muted: "#5d5873",
    accent: "#5432e6",
    accentSoft: "#e6e0ff",
    onAccent: "#ffffff",
    correct: "#13784a",
    correctSoft: "#ddf3e7",
    wrong: "#bf2f2c",
    wrongSoft: "#fbe3e1",
  },
  space: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "40px", xxl: "64px" },
  radius: { sm: "8px", md: "14px", lg: "24px", tail: "6px", pill: "999px" },
  fontSize: {
    xs: "12px",
    sm: "14px",
    md: "16px",
    lg: "20px",
    xl: "28px",
    prompt: "clamp(24px, 7vw, 30px)",
    display: "clamp(44px, 15vw, 68px)",
  },
  lineHeight: { tight: "1.12", snug: "1.3", body: "1.55" },
  tap: { minHeight: "48px", choice: "56px" },
  motion: { fast: "120ms", base: "220ms" },
  layout: { maxWidth: "480px" },
  safeArea: {
    top: "env(safe-area-inset-top, 0px)",
    right: "env(safe-area-inset-right, 0px)",
    bottom: "env(safe-area-inset-bottom, 0px)",
    left: "env(safe-area-inset-left, 0px)",
  },
});

globalStyle(":root", {
  colorScheme: "light dark",
  "@media": {
    "(prefers-color-scheme: dark)": {
      vars: {
        [vars.color.background]: "#15131d",
        [vars.color.surface]: "#211e2d",
        [vars.color.sunken]: "#272436",
        [vars.color.line]: "#383349",
        [vars.color.text]: "#f2f0f9",
        [vars.color.muted]: "#aaa5bd",
        [vars.color.accent]: "#a897ff",
        [vars.color.accentSoft]: "#2f2856",
        [vars.color.onAccent]: "#15131d",
        [vars.color.correct]: "#5fd394",
        [vars.color.correctSoft]: "#16342a",
        [vars.color.wrong]: "#ff8a82",
        [vars.color.wrongSoft]: "#3d1f22",
      },
    },
  },
});

globalStyle("html, body, #root", { height: "100%", margin: 0 });

globalStyle("body", {
  background: vars.color.background,
  color: vars.color.text,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", "Malgun Gothic", sans-serif',
  fontSize: vars.fontSize.md,
  lineHeight: vars.lineHeight.body,
  overscrollBehavior: "none",
  WebkitTextSizeAdjust: "100%",
  WebkitTapHighlightColor: "transparent",
  wordBreak: "keep-all",
  overflowWrap: "anywhere",
});

globalStyle("*, *::before, *::after", { boxSizing: "border-box" });

globalStyle("*, *::before, *::after", {
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      animationDuration: "0.01ms !important",
      animationIterationCount: "1 !important",
      transitionDuration: "0.01ms !important",
    },
  },
});
