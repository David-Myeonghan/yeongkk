import { style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

export const hero = style({ display: "flex", flexDirection: "column", gap: vars.space.md });

export const reply = style({
  marginBlock: 0,
  fontSize: vars.fontSize.lg,
  fontWeight: 700,
  lineHeight: vars.lineHeight.snug,
});
