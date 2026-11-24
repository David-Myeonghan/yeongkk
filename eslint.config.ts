import js from "@eslint/js";
import tseslint from "typescript-eslint";
import noSwitchOnKind from "./tools/eslint-rules/no-switch-on-kind";

export default tseslint.config(
  {
    ignores: ["**/node_modules/", "**/dist/", ".superpowers/", "**/.wrangler/", "**/coverage/", "**/.expo/"],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // registry/ 의 any 4곳은 JSON 파싱 결과·잘못된 입력 시험용이라 타입을 좁히지 않는다.
    files: ["registry/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    plugins: { yk: { rules: { "no-switch-on-kind": noSwitchOnKind } } },
    rules: { "yk/no-switch-on-kind": "error" },
  },
);
