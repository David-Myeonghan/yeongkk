import { basicUIPlugin } from "@stackflow/plugin-basic-ui";
import { basicRendererPlugin } from "@stackflow/plugin-renderer-basic";
import { stackflow } from "@stackflow/react";
import { Home } from "./activities/Home";
import { Question } from "./activities/Question";
import { Result } from "./activities/Result";
import { WordCard } from "./activities/WordCard";
import { config } from "./stackflow.config";
import { vars } from "./styles/theme.css";

export const { Stack } = stackflow({
  config,
  components: { Home, Question, WordCard, Result },
  plugins: [
    basicRendererPlugin(),
    basicUIPlugin({
      theme: "cupertino",
      backgroundColor: vars.color.background,
      appBar: {
        textColor: vars.color.text,
        iconColor: vars.color.text,
        borderColor: vars.color.line,
        backButton: { ariaLabel: "처음으로" },
      },
    }),
  ],
});
