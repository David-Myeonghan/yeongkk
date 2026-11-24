import { keyframes, style, styleVariants } from "@vanilla-extract/css";
import { vars } from "./theme.css";

const sideGap = vars.space.lg;

export const page = style({
  minHeight: "100%",
  width: "100%",
  maxWidth: vars.layout.maxWidth,
  marginInline: "auto",
  display: "flex",
  flexDirection: "column",
  paddingTop: vars.space.md,
  paddingInline: sideGap,
});

export const rootPage = style({
  paddingTop: `calc(${vars.space.xxl} + ${vars.safeArea.top})`,
});

export const heading = style({
  margin: 0,
  selectors: {
    "&:focus": { outline: "none" },
    "&:focus-visible": { outline: `3px solid ${vars.color.accent}`, outlineOffset: "6px", borderRadius: vars.radius.sm },
  },
});

export const footer = style({
  position: "sticky",
  bottom: 0,
  marginTop: "auto",
  marginInline: `calc(-1 * ${sideGap})`,
  display: "flex",
  flexDirection: "column",
  gap: vars.space.sm,
  paddingTop: vars.space.md,
  paddingInline: sideGap,
  paddingBottom: `calc(${vars.space.lg} + ${vars.safeArea.bottom})`,
  background: vars.color.background,
});

export const spacer = style({ flexGrow: 1, minHeight: vars.space.lg });

const buttonBase = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: vars.space.sm,
  width: "100%",
  minHeight: vars.tap.choice,
  paddingBlock: vars.space.sm,
  paddingInline: vars.space.lg,
  borderRadius: vars.radius.md,
  fontFamily: "inherit",
  fontSize: vars.fontSize.lg,
  fontWeight: 700,
  lineHeight: vars.lineHeight.snug,
  cursor: "pointer",
  transitionProperty: "transform, background-color, border-color",
  transitionDuration: vars.motion.fast,
  selectors: {
    "&:focus-visible": { outline: `3px solid ${vars.color.accent}`, outlineOffset: "3px" },
    "&:active:not(:disabled)": { transform: "scale(0.98)" },
    "&:disabled": { cursor: "default", opacity: 0.6 },
  },
});

export const button = styleVariants({
  primary: [
    buttonBase,
    { border: "2px solid transparent", background: vars.color.accent, color: vars.color.onAccent },
  ],
  secondary: [
    buttonBase,
    {
      border: `2px solid ${vars.color.line}`,
      background: "transparent",
      color: vars.color.text,
      selectors: { "&:active:not(:disabled)": { background: vars.color.sunken } },
    },
  ],
});

const bubbleBase = style({
  display: "block",
  width: "fit-content",
  maxWidth: "100%",
  paddingBlock: vars.space.md,
  paddingInline: vars.space.lg,
});

export const bubble = styleVariants({
  said: [
    bubbleBase,
    {
      borderRadius: `${vars.radius.lg} ${vars.radius.lg} ${vars.radius.lg} ${vars.radius.tail}`,
      border: `3px solid ${vars.color.text}`,
      background: vars.color.surface,
      color: vars.color.text,
    },
  ],
  brand: [
    bubbleBase,
    {
      borderRadius: `${vars.radius.lg} ${vars.radius.lg} ${vars.radius.lg} ${vars.radius.tail}`,
      border: `3px solid ${vars.color.accent}`,
      background: vars.color.accent,
      color: vars.color.onAccent,
    },
  ],
  reply: [
    bubbleBase,
    {
      marginInlineStart: "auto",
      borderRadius: `${vars.radius.lg} ${vars.radius.lg} ${vars.radius.tail} ${vars.radius.lg}`,
      border: `2px solid ${vars.color.line}`,
      background: vars.color.surface,
      color: vars.color.text,
    },
  ],
});

export const display = style({
  fontSize: vars.fontSize.display,
  fontWeight: 900,
  lineHeight: vars.lineHeight.tight,
  letterSpacing: "-0.03em",
});

const pop = keyframes({
  from: { transform: "scale(0.6)", opacity: 0 },
  to: { transform: "scale(1)", opacity: 1 },
});

export const popIn = style({ animation: `${pop} ${vars.motion.base} cubic-bezier(.2,1.4,.4,1) both` });

export const skeleton = style({
  minHeight: vars.tap.choice,
  borderRadius: vars.radius.md,
  background: vars.color.sunken,
});

export const notice = style({
  margin: 0,
  marginTop: vars.space.lg,
  fontSize: vars.fontSize.md,
  fontWeight: 600,
  color: vars.color.text,
});

export const errorText = style({
  margin: 0,
  marginBottom: vars.space.sm,
  fontSize: vars.fontSize.md,
  lineHeight: vars.lineHeight.body,
  color: vars.color.text,
});

export const appBarTitle = style({ fontSize: vars.fontSize.md, fontWeight: 700, fontVariantNumeric: "tabular-nums" });
