import { AppScreen } from "@stackflow/plugin-basic-ui";
import { vars } from "../styles/theme.css";
import type { ActivityComponentType } from "@stackflow/react";

export const WordCard: ActivityComponentType<"WordCard"> = () => <AppScreen backgroundColor={vars.color.background} appBar={{ title: "단어 카드" }}>{null}</AppScreen>;
