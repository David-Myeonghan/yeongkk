import { describe, expect, it } from "vitest";
import { parseAddedLines } from "./added-lines";

const header = (path: string) => `diff --git a/${path} b/${path}\nindex 111..222 100644\n--- a/${path}\n+++ b/${path}\n`;

describe("parseAddedLines", () => {
  it("파일 여러 개와 hunk 여러 개를 읽는다", () => {
    const diff =
      header("a.ts") + "@@ -1,0 +2,3 @@\n+x\n+y\n+z\n@@ -10 +20,2 @@\n-old\n+n1\n+n2\n" +
      header("dir/b.ts") + "@@ -4,2 +4,2 @@\n-p\n-q\n+r\n+s\n";
    const map = parseAddedLines(diff);
    expect([...(map.get("a.ts") ?? [])]).toEqual([2, 3, 4, 20, 21]);
    expect([...(map.get("dir/b.ts") ?? [])]).toEqual([4, 5]);
  });

  it("개수 없는 +5 는 한 줄이다", () => {
    const map = parseAddedLines(header("a.ts") + "@@ -5 +5 @@\n-a\n+b\n");
    expect([...(map.get("a.ts") ?? [])]).toEqual([5]);
  });

  it("+12,0 인 순수 삭제는 아무것도 더하지 않는다", () => {
    const map = parseAddedLines(header("a.ts") + "@@ -12,2 +12,0 @@\n-a\n-b\n");
    expect(map.get("a.ts")?.size ?? 0).toBe(0);
  });

  it("이름이 바뀐 파일은 새 경로로 적는다", () => {
    const diff = "diff --git a/old.ts b/new.ts\nsimilarity index 80%\nrename from old.ts\nrename to new.ts\n--- a/old.ts\n+++ b/new.ts\n@@ -3 +3 @@\n-a\n+b\n";
    const map = parseAddedLines(diff);
    expect([...(map.get("new.ts") ?? [])]).toEqual([3]);
    expect(map.has("old.ts")).toBe(false);
  });

  it("공백이 든 경로는 끝 탭을 떼고 읽는다", () => {
    const map = parseAddedLines("diff --git a/sp ace.ts b/sp ace.ts\n--- a/sp ace.ts\t\n+++ b/sp ace.ts\t\n@@ -0,0 +1 @@\n+x\n");
    expect([...map.keys()]).toEqual(["sp ace.ts"]);
    expect([...(map.get("sp ace.ts") ?? [])]).toEqual([1]);
  });

  it("한글 파일 이름을 그대로 읽는다", () => {
    const map = parseAddedLines(header("words/한글 단어.ts") + "@@ -0,0 +3,2 @@\n+a\n+b\n");
    expect([...(map.get("words/한글 단어.ts") ?? [])]).toEqual([3, 4]);
  });

  it("내용이 '++ ' 로 시작하는 추가 줄을 파일 머리로 오해하지 않는다", () => {
    const map = parseAddedLines(header("a.ts") + "@@ -0,0 +1 @@\n+++ evil\n@@ -5 +6 @@\n-x\n+y\n");
    expect([...map.keys()]).toEqual(["a.ts"]);
    expect([...(map.get("a.ts") ?? [])]).toEqual([1, 6]);
  });

  it("지운 파일(/dev/null)은 건너뛴다", () => {
    const diff = "diff --git a/gone.ts b/gone.ts\ndeleted file mode 100644\n--- a/gone.ts\n+++ /dev/null\n@@ -1,2 +0,0 @@\n-a\n-b\n";
    expect(parseAddedLines(diff).size).toBe(0);
  });
});
