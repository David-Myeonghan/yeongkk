import { style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

export const hero = style({ display: "flex", flexDirection: "column", gap: vars.space.md });

export const reply = style({
  marginBlock: 0,
  fontSize: vars.fontSize.lg,
  fontWeight: 700,
  lineHeight: vars.lineHeight.snug,
});

export const privacyLink = style({
  alignSelf: "center",
  display: "inline-flex",
  alignItems: "center",
  minHeight: vars.tap.minHeight,
  paddingInline: vars.space.md,
  fontSize: vars.fontSize.sm,
  color: vars.color.muted,
  textDecoration: "underline",
  textUnderlineOffset: "3px",
  borderRadius: vars.radius.sm,
  selectors: {
    "&:focus-visible": { outline: `3px solid ${vars.color.accent}`, outlineOffset: "2px" },
  },
});
