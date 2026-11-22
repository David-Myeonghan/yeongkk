import { createGlobalTheme, globalStyle } from "@vanilla-extract/css";

export const vars = createGlobalTheme(":root", {
  color: {
    background: "#ffffff",
    surface: "#f4f5f7",
    text: "#17181a",
    muted: "#6b7078",
    accent: "#3b5bfd",
    onAccent: "#ffffff",
    correct: "#1f9d55",
    wrong: "#d93f3f",
  },
  space: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "40px" },
  radius: { sm: "8px", md: "14px", lg: "20px" },
  fontSize: { sm: "14px", md: "16px", lg: "20px", xl: "32px" },
  tap: { minHeight: "48px" },
  safeArea: {
    top: "env(safe-area-inset-top, 0px)",
    right: "env(safe-area-inset-right, 0px)",
    bottom: "env(safe-area-inset-bottom, 0px)",
    left: "env(safe-area-inset-left, 0px)",
  },
});

globalStyle(":root", {
  "@media": {
    "(prefers-color-scheme: dark)": {
      vars: {
        [vars.color.background]: "#0f1012",
        [vars.color.surface]: "#1b1d21",
        [vars.color.text]: "#f2f3f5",
        [vars.color.muted]: "#9aa0a8",
        [vars.color.accent]: "#7d93ff",
        [vars.color.onAccent]: "#0f1012",
        [vars.color.correct]: "#3ec27a",
        [vars.color.wrong]: "#f06a6a",
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
  overscrollBehavior: "none",
  WebkitTextSizeAdjust: "100%",
  WebkitTapHighlightColor: "transparent",
});

globalStyle("*, *::before, *::after", { boxSizing: "border-box" });
