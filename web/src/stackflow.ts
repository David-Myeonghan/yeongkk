import { basicUIPlugin } from "@stackflow/plugin-basic-ui";
import { basicRendererPlugin } from "@stackflow/plugin-renderer-basic";
import { stackflow } from "@stackflow/react";
import { Home } from "./activities/Home";
import { Question } from "./activities/Question";
import { Result } from "./activities/Result";
import { WordCard } from "./activities/WordCard";
import { config } from "./stackflow.config";

export const { Stack } = stackflow({
  config,
  components: { Home, Question, WordCard, Result },
  plugins: [basicRendererPlugin(), basicUIPlugin({ theme: "cupertino" })],
});
