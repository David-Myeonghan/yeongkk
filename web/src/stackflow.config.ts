import { defineConfig } from "@stackflow/config";

declare module "@stackflow/config" {
  interface Register {
    Home: Record<string, never>;
    Question: Record<string, never>;
    WordCard: Record<string, never>;
    Result: Record<string, never>;
  }
}

export const config = defineConfig({
  activities: [{ name: "Home" }, { name: "Question" }, { name: "WordCard" }, { name: "Result" }],
  initialActivity: () => "Home",
  transitionDuration: 270,
});
