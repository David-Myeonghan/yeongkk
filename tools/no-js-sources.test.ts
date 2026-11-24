import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const JS_SOURCE = /\.(js|mjs|cjs|jsx)$/;

export function findJsSources(files: string[]): string[] {
  return files.filter((file) => JS_SOURCE.test(file) && !/(^|\/)node_modules\//.test(file));
}

export function splitNulListing(listing: string): string[] {
  return listing.split("\0").filter(Boolean);
}

const hint = (found: string[]) =>
  `JavaScript 소스가 있어요. TypeScript(.ts/.tsx)로 작성하세요: ${found.join(", ")}`;

describe("findJsSources", () => {
  it("js 계열 확장자만 찾고 node_modules 는 건너뛴다", () => {
    const files = ["a.ts", "b.js", "web/c.mjs", "d.cjs", "e.jsx", "x/node_modules/f.js", "g.json", "h.tsx", "notjs"];
    expect(findJsSources(files)).toEqual(["b.js", "web/c.mjs", "d.cjs", "e.jsx"]);
  });
});

describe("splitNulListing", () => {
  it("NUL 로 나누고 마지막 빈 칸을 버린다", () => {
    expect(splitNulListing("a.ts\0b.js\0")).toEqual(["a.ts", "b.js"]);
  });

  it("한글 이름의 .js 도 찾는다", () => {
    expect(findJsSources(splitNulListing("web/src/a.ts\0web/src/한글.js\0"))).toEqual(["web/src/한글.js"]);
  });

  it("옛 방식(따옴표 · 8진수 이스케이프, 줄바꿈 분리)은 놓친다", () => {
    const quoted = '"web/src/\\355\\225\\234\\352\\270\\200.js"\n';
    expect(findJsSources(quoted.split("\n").filter(Boolean))).toEqual([]);
  });
});

describe("저장소", () => {
  it("추적 중인 JavaScript 소스가 없다", () => {
    const root = resolve(import.meta.dirname, "..");
    let listing: string;
    try {
      listing = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      throw new Error(`git 으로 추적 파일 목록을 읽지 못했어요. git 이 설치되어 있고 ${root} 가 git 저장소(체크아웃)인지 확인하세요: ${String(e)}`, { cause: e });
    }
    const tracked = splitNulListing(listing);
    const found = findJsSources(tracked);
    expect(found, hint(found)).toEqual([]);
  });
});
