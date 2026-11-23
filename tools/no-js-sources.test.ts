import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const JS_SOURCE = /\.(js|mjs|cjs|jsx)$/;

export function findJsSources(files: string[]): string[] {
  return files.filter((file) => JS_SOURCE.test(file) && !/(^|\/)node_modules\//.test(file));
}

const hint = (found: string[]) =>
  `JavaScript 소스가 있어요. TypeScript(.ts/.tsx)로 작성하세요: ${found.join(", ")}`;

describe("findJsSources", () => {
  it("js 계열 확장자만 찾고 node_modules 는 건너뛴다", () => {
    const files = ["a.ts", "b.js", "web/c.mjs", "d.cjs", "e.jsx", "x/node_modules/f.js", "g.json", "h.tsx", "notjs"];
    expect(findJsSources(files)).toEqual(["b.js", "web/c.mjs", "d.cjs", "e.jsx"]);
  });
});

describe("저장소", () => {
  it("추적 중인 JavaScript 소스가 없다", () => {
    const root = resolve(import.meta.dirname, "..");
    let listing: string;
    try {
      listing = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      throw new Error(`git 으로 추적 파일 목록을 읽지 못했어요. git 이 설치되어 있고 ${root} 가 git 저장소(체크아웃)인지 확인하세요: ${String(e)}`, { cause: e });
    }
    const tracked = listing.split("\n").filter(Boolean);
    const found = findJsSources(tracked);
    expect(found, hint(found)).toEqual([]);
  });
});
