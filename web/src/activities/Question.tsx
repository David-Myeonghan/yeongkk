import { AppScreen } from "@stackflow/plugin-basic-ui";
import { vars } from "../styles/theme.css";
import type { ActivityComponentType } from "@stackflow/react";

export const Question: ActivityComponentType<"Question"> = () => <AppScreen backgroundColor={vars.color.background} appBar={{ title: "문제" }}>{null}</AppScreen>;
