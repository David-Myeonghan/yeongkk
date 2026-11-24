import { defineConfig } from "@stackflow/config";

declare module "@stackflow/config" {
  interface Register {
    Home: Record<string, never>;
    Question: { index: string };
    WordCard: { index: string };
    Result: Record<string, never>;
  }
}

export const config = defineConfig({
  activities: [{ name: "Home" }, { name: "Question" }, { name: "WordCard" }, { name: "Result" }],
  initialActivity: () => "Home",
  transitionDuration: 270,
});
