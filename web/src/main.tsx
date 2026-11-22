import "@stackflow/plugin-basic-ui/index.css";
import { PROTOCOL_VERSION } from "@yk/bridge/protocol";
import { RESULT_COPY } from "@yk/quiz-core/score";
import { createRoot } from "react-dom/client";
import { Stack } from "./stackflow";
import "./styles/theme.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root 없음");
root.dataset.protocol = String(PROTOCOL_VERSION);
root.dataset.copyLocales = Object.keys(RESULT_COPY).join(",");

createRoot(root).render(<Stack />);
