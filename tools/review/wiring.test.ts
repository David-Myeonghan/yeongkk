import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTEXT_DIR, CONTEXT_FILES } from "./context";
import { OUT_DIR, OUT_FILES } from "./validate";

const DOCS = ["guide.md", "adversarial.md", "output-rules.md"];
const read = (name: string) => readFileSync(join(import.meta.dirname, name), "utf8");

describe("지침 문서와 코드의 이름이 맞는다", () => {
  it("세 문서가 있다", () => {
    for (const name of DOCS) expect(existsSync(join(import.meta.dirname, name)), name).toBe(true);
  });

  it("문서가 말하는 review-context/ · review-out/ 파일은 코드가 만들거나 읽는 이름이다", () => {
    const contextNames = new Set<string>(Object.values(CONTEXT_FILES));
    const outNames = new Set<string>(Object.values(OUT_FILES));
    const mentioned: string[] = [];
    for (const doc of DOCS) {
      for (const m of read(doc).matchAll(/(review-context|review-out)\/([\w.-]+\.\w+)/g)) {
        const [, dir, file] = m;
        mentioned.push(`${dir}/${file}`);
        expect(dir === CONTEXT_DIR ? contextNames : outNames, `${doc}: ${dir}/${file}`).toContain(file);
      }
    }
    expect(mentioned.length).toBeGreaterThanOrEqual(5);
  });

  it("문서의 폴더 이름도 코드의 상수와 같다", () => {
    const text = DOCS.map(read).join("\n");
    expect(text).toContain(`${CONTEXT_DIR}/`);
    expect(text).toContain(`${OUT_DIR}/`);
  });

  it("guide.md 의 목록에 적힌 자료 이름은 모두 context.ts 가 만드는 이름이다", () => {
    const known = new Set<string>([...Object.values(CONTEXT_FILES), ...Object.values(OUT_FILES), "README.md"]);
    const names = [...read("guide.md").matchAll(/`([\w.-]+\.(?:md|patch|txt|json))`/g)].map((m) => m[1] ?? "");
    expect(names.length).toBeGreaterThan(3);
    for (const n of names) expect(known, n).toContain(n);
  });

  it("output-rules.md 에 적힌 출력 파일 이름은 모두 validate.ts 가 읽는 이름이다", () => {
    const names = [...read("output-rules.md").matchAll(/`(?:review-out\/)?([\w.-]+\.(?:md|txt|json))`/g)].map((m) => m[1] ?? "");
    for (const n of names) expect(Object.values(OUT_FILES), n).toContain(n);
  });
});
