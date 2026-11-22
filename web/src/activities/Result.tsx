import { AppScreen } from "@stackflow/plugin-basic-ui";
import { vars } from "../styles/theme.css";
import type { ActivityComponentType } from "@stackflow/react";

export const Result: ActivityComponentType<"Result"> = () => <AppScreen backgroundColor={vars.color.background} appBar={{ title: "결과" }}>{null}</AppScreen>;
