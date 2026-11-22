import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineConfig } from "vite";

const sibling = (dir: string) => fileURLToPath(new URL(`../${dir}`, import.meta.url));

export default defineConfig({
  plugins: [react(), vanillaExtractPlugin()],
  resolve: {
    alias: {
      "@yk/bridge": sibling("bridge"),
      "@yk/quiz-core": sibling("quiz-core"),
    },
  },
  server: {
    proxy: { "/api": "http://localhost:8787" },
  },
  build: { outDir: "dist", sourcemap: true },
});
