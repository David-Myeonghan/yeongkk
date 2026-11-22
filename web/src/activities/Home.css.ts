import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

export const page = style({
  minHeight: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: vars.space.md,
  paddingTop: `calc(${vars.space.lg} + ${vars.safeArea.top})`,
  paddingRight: `calc(${vars.space.lg} + ${vars.safeArea.right})`,
  paddingBottom: `calc(${vars.space.lg} + ${vars.safeArea.bottom})`,
  paddingLeft: `calc(${vars.space.lg} + ${vars.safeArea.left})`,
});

export const title = style({ margin: 0, fontSize: vars.fontSize.xl, fontWeight: 800 });

export const description = style({ margin: 0, fontSize: vars.fontSize.md, color: vars.color.muted });

export const startButton = style({
  marginTop: vars.space.lg,
  minHeight: vars.tap.minHeight,
  width: "100%",
  border: "none",
  borderRadius: vars.radius.md,
  background: vars.color.accent,
  color: vars.color.onAccent,
  fontFamily: "inherit",
  fontSize: vars.fontSize.lg,
  fontWeight: 700,
  cursor: "pointer",
});
