import "@stackflow/plugin-basic-ui/index.css";
import { PROTOCOL_VERSION } from "@yk/bridge/protocol";
import { RESULT_COPY } from "@yk/quiz-core/score";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppDataProvider } from "./app/AppData";
import { telemetry, track } from "./app/services";
import { Stack } from "./stackflow";
import { getBridge } from "./platform/bridge";
import { hostKind } from "./platform/hostKind";
import { attachLeaveHooks } from "./telemetry/lifecycle";
import "./styles/theme.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root 없음");
root.dataset.protocol = String(PROTOCOL_VERSION);
root.dataset.copyLocales = Object.keys(RESULT_COPY).join(",");

attachLeaveHooks(document, window, telemetry);
track("app_open", { fromShare: new URLSearchParams(window.location.search).has("r") });

const helloAt = Date.now();
const helloDone = (result: "app" | "none") => track("bridge_hello", { result, ms: Math.max(0, Math.round(Date.now() - helloAt)) });

void getBridge()
  .ready()
  .then(
    (info) => {
      document.documentElement.dataset.host = hostKind(info);
      helloDone(info ? "app" : "none");
    },
    () => {
      document.documentElement.dataset.host = hostKind(null);
      helloDone("none");
    },
  );

createRoot(root).render(
  <StrictMode>
    <AppDataProvider>
      <Stack />
    </AppDataProvider>
  </StrictMode>,
);
