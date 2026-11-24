import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTEXT_DIR, CONTEXT_FILES } from "./context";
import { OUT_DIR, OUT_FILES, validateReview } from "./validate";

const DOCS = ["guide.md", "adversarial.md", "output-rules.md"];
const read = (name: string) => readFileSync(join(import.meta.dirname, name), "utf8");
const contextNames: readonly string[] = Object.values(CONTEXT_FILES);
const outNames: readonly string[] = Object.values(OUT_FILES);

export function findMismatches(text: string): string[] {
  const bad: string[] = [];
  for (const m of text.matchAll(/(review-context|review-out)\/([\w.-]+\.\w+)/g)) {
    const [whole = "", dir, file = ""] = m;
    const allowed = dir === CONTEXT_DIR ? contextNames : outNames;
    if (!allowed.includes(file)) bad.push(whole);
  }
  return bad;
}

describe("findMismatches", () => {
  it("출력 파일을 자료 폴더 것으로 적으면 잡는다", () => {
    expect(findMismatches("`review-context/review.md`")).toEqual(["review-context/review.md"]);
    expect(findMismatches("`review-out/pr.md`")).toEqual(["review-out/pr.md"]);
    expect(findMismatches("`review-context/pr.md` `review-out/review.md`")).toEqual([]);
  });
});

describe("지침 문서와 코드의 이름이 맞는다", () => {
  it("세 문서가 있다", () => {
    for (const name of DOCS) expect(existsSync(join(import.meta.dirname, name)), name).toBe(true);
  });

  it("문서가 말하는 review-context/ · review-out/ 파일은 각자 맞는 상수의 이름이다", () => {
    let count = 0;
    for (const doc of DOCS) {
      const text = read(doc);
      count += [...text.matchAll(/(review-context|review-out)\/[\w.-]+\.\w+/g)].length;
      expect(findMismatches(text), doc).toEqual([]);
    }
    expect(count).toBeGreaterThanOrEqual(5);
  });

  it("문서의 폴더 이름도 코드의 상수와 같다", () => {
    const text = DOCS.map(read).join("\n");
    expect(text).toContain(`${CONTEXT_DIR}/`);
    expect(text).toContain(`${OUT_DIR}/`);
  });

  it("guide.md 의 목록에 적힌 이름은 자료 이름이다(README.md 는 저장소 문서)", () => {
    const names = [...read("guide.md").matchAll(/`([\w.-]+\.(?:md|patch|txt|json))`/g)].map((m) => m[1] ?? "");
    expect(names.length).toBeGreaterThan(3);
    for (const n of names) expect(n === "README.md" || contextNames.includes(n), n).toBe(true);
  });

  it("output-rules.md 에 적힌 출력 파일 이름은 출력 이름이다", () => {
    const names = [...read("output-rules.md").matchAll(/`(?:review-out\/)?([\w.-]+\.(?:md|txt|json))`/g)].map((m) => m[1] ?? "");
    expect(names.length).toBeGreaterThan(2);
    for (const n of names) expect(outNames, n).toContain(n);
  });

  it("output-rules.md 의 표지와 판정 줄 예시를 validate.ts 가 받아들인다", () => {
    const block = /```\n([\s\S]*?)```/.exec(read("output-rules.md"))?.[1] ?? "";
    const sha = "a".repeat(40);
    const example = block
      .replace("<PR head 의 40자 커밋>", sha)
      .replace("<full|incremental>", "full")
      .replace("APPROVE | REQUEST_CHANGES", "APPROVE");
    const lines = example.split("\n");
    const body = `${lines[0] ?? ""}\n${lines[1] ?? ""}\n`;
    expect(lines[0]).toContain("yk-review");
    expect(lines[1]).toContain("판정");
    expect(validateReview({ expected: { headSha: sha, mode: "full" }, body, decision: "APPROVE", comments: undefined, addedLines: new Map() })).toEqual({ ok: true, decision: "APPROVE", comments: [] });
  });
});
