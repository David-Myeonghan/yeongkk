import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "registry/**/*.test.ts",
      "bridge/**/*.test.ts",
      "quiz-core/**/*.test.ts",
      "tools/**/*.test.ts",
      "app/src/**/*.test.ts",
      "app/scripts/**/*.test.ts",
    ],
  },
});
