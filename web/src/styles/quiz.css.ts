import { style, styleVariants } from "@vanilla-extract/css";
import { vars } from "./theme.css";

export const segments = style({
  display: "flex",
  gap: vars.space.xs,
  marginBottom: vars.space.lg,
});

const segmentBase = style({ flex: 1, height: "6px", borderRadius: vars.radius.pill });

export const segment = styleVariants({
  done: [segmentBase, { background: vars.color.accent }],
  current: [segmentBase, { background: vars.color.accent, opacity: 0.45 }],
  todo: [segmentBase, { background: vars.color.line }],
});

export const askRow = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
  marginBottom: vars.space.md,
  fontSize: vars.fontSize.md,
  fontWeight: 600,
  color: vars.color.muted,
});

export const newBadge = style({
  display: "inline-flex",
  alignItems: "center",
  paddingInline: vars.space.sm,
  minHeight: "24px",
  borderRadius: vars.radius.pill,
  background: vars.color.accentSoft,
  color: vars.color.text,
  fontSize: vars.fontSize.xs,
  fontWeight: 800,
  letterSpacing: "0.04em",
});

export const promptText = styleVariants({
  meaning: { fontSize: vars.fontSize.display, fontWeight: 900, lineHeight: vars.lineHeight.tight, letterSpacing: "-0.03em" },
  word: { fontSize: vars.fontSize.prompt, fontWeight: 800, lineHeight: vars.lineHeight.snug, letterSpacing: "-0.01em" },
});

export const choices = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space.sm,
  marginTop: "auto",
  paddingTop: vars.space.xl,
  paddingBottom: `calc(${vars.space.lg} + ${vars.safeArea.bottom})`,
});

const choiceBase = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.md,
  width: "100%",
  minHeight: vars.tap.choice,
  paddingBlock: vars.space.sm,
  paddingInline: vars.space.md,
  border: `2px solid ${vars.color.line}`,
  borderRadius: vars.radius.md,
  background: vars.color.surface,
  color: vars.color.text,
  fontFamily: "inherit",
  textAlign: "start",
  lineHeight: vars.lineHeight.snug,
  cursor: "pointer",
  transitionProperty: "transform, border-color, background-color",
  transitionDuration: vars.motion.fast,
  selectors: {
    "&:focus-visible": { outline: `3px solid ${vars.color.accent}`, outlineOffset: "3px" },
    '&:active:not([aria-disabled="true"])': { transform: "scale(0.98)", borderColor: vars.color.text },
    '&[aria-disabled="true"]': { cursor: "default" },
  },
});

export const choiceSize = styleVariants({
  meaning: { fontSize: vars.fontSize.md, fontWeight: 600 },
  word: { fontSize: vars.fontSize.lg, fontWeight: 800 },
});

export const choice = styleVariants({
  idle: [choiceBase],
  right: [choiceBase, { borderColor: vars.color.correct, background: vars.color.correctSoft }],
  picked: [choiceBase, { borderColor: vars.color.wrong, background: vars.color.wrongSoft }],
  rest: [choiceBase, { color: vars.color.muted }],
});

export const choiceText = style({ flex: 1 });

export const mark = styleVariants({
  right: { display: "inline-flex", alignItems: "center", gap: vars.space.xs, flexShrink: 0, color: vars.color.correct, fontSize: vars.fontSize.sm, fontWeight: 800 },
  picked: { display: "inline-flex", alignItems: "center", gap: vars.space.xs, flexShrink: 0, color: vars.color.wrong, fontSize: vars.fontSize.sm, fontWeight: 800 },
});

export const verdict = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
  marginBottom: vars.space.xs,
  fontSize: vars.fontSize.lg,
  fontWeight: 800,
});

export const verdictTone = styleVariants({
  right: { color: vars.color.correct },
  wrong: { color: vars.color.wrong },
});

export const verdictIcon = styleVariants({
  right: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: vars.radius.pill, background: vars.color.correctSoft },
  wrong: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: vars.radius.pill, background: vars.color.wrongSoft },
});

export const answerLine = style({ margin: 0, fontSize: vars.fontSize.md, color: vars.color.text });

export const pickedLine = style({ margin: 0, fontSize: vars.fontSize.sm, color: vars.color.muted });

export const word = style({ marginTop: vars.space.xl, marginBottom: vars.space.sm });

export const meaning = style({
  margin: 0,
  fontSize: vars.fontSize.xl,
  fontWeight: 700,
  lineHeight: vars.lineHeight.snug,
  letterSpacing: "-0.01em",
});

export const section = style({ marginTop: vars.space.xl });

export const label = style({
  margin: 0,
  marginBottom: vars.space.sm,
  fontSize: vars.fontSize.sm,
  fontWeight: 700,
  color: vars.color.muted,
});

export const examples = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space.sm,
  margin: 0,
  padding: 0,
  listStyle: "none",
});

export const example = style({
  width: "fit-content",
  maxWidth: "100%",
  paddingBlock: vars.space.sm,
  paddingInline: vars.space.md,
  borderRadius: `${vars.radius.md} ${vars.radius.md} ${vars.radius.md} ${vars.radius.tail}`,
  background: vars.color.sunken,
  fontSize: vars.fontSize.md,
});

export const origin = style({ margin: 0, fontSize: vars.fontSize.md, color: vars.color.text });

export const scoreLine = style({ display: "block", fontVariantNumeric: "tabular-nums" });

export const tierLine = style({
  marginTop: vars.space.md,
  fontSize: vars.fontSize.xl,
  fontWeight: 800,
  lineHeight: vars.lineHeight.snug,
});

export const shareNote = style({
  marginTop: vars.space.lg,
  fontSize: vars.fontSize.md,
  fontWeight: 600,
  color: vars.color.text,
});

export const shareHint = style({ margin: 0, color: vars.color.muted, fontWeight: 600 });

export const shareUrl = style({
  margin: 0,
  marginTop: vars.space.sm,
  padding: vars.space.md,
  borderRadius: vars.radius.md,
  background: vars.color.sunken,
  fontWeight: 500,
  userSelect: "all",
  WebkitUserSelect: "all",
  overflowWrap: "anywhere",
  wordBreak: "break-all",
});

export const report = style({ display: "flex", flexDirection: "column", gap: vars.space.sm });

export const reportRow = style({ display: "flex", gap: vars.space.sm, alignItems: "stretch" });

export const reportInput = style({
  flex: 1,
  minWidth: 0,
  minHeight: vars.tap.minHeight,
  paddingInline: vars.space.md,
  border: `2px solid ${vars.color.line}`,
  borderRadius: vars.radius.md,
  background: vars.color.surface,
  color: vars.color.text,
  fontFamily: "inherit",
  fontSize: vars.fontSize.md,
  selectors: {
    "&::placeholder": { color: vars.color.muted, opacity: 1 },
    "&:focus-visible": { outline: `3px solid ${vars.color.accent}`, outlineOffset: "2px" },
  },
});

export const reportSend = style({
  flexShrink: 0,
  minHeight: vars.tap.minHeight,
  paddingInline: vars.space.md,
  border: `2px solid ${vars.color.line}`,
  borderRadius: vars.radius.md,
  background: "transparent",
  color: vars.color.text,
  fontFamily: "inherit",
  fontSize: vars.fontSize.md,
  fontWeight: 700,
  cursor: "pointer",
  selectors: {
    "&:focus-visible": { outline: `3px solid ${vars.color.accent}`, outlineOffset: "2px" },
    "&:active:not(:disabled)": { background: vars.color.sunken },
    "&:disabled": { cursor: "default", opacity: 0.6 },
  },
});

export const reportNote = style({ margin: 0, fontSize: vars.fontSize.sm, fontWeight: 600, color: vars.color.muted });
