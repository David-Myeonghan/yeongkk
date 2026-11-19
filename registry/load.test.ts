import { test, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path";
import { loadWords, loadBanned } from "./load";

function repo() {
  const r = mkdtempSync(join(tmpdir(), "yk-"));
  mkdirSync(join(r, "words/ko-KR"), { recursive: true });
  mkdirSync(join(r, "config/ko-KR"), { recursive: true });
  writeFileSync(join(r, "words/ko-KR/a.json"), JSON.stringify({ id: "a" }));
  writeFileSync(join(r, "words/ko-KR/b.json"), "{ broken");
  writeFileSync(join(r, "config/ko-KR/banned.txt"), "# 주석\n욕1\n\n욕2\n");
  return r;
}
test("단어 파일을 로케일 폴더와 함께 읽는다", () => {
  const ws = loadWords(repo()).sort((x, y) => x.fileName.localeCompare(y.fileName));
  expect(ws.map(w => w.path)).toEqual(["words/ko-KR/a.json", "words/ko-KR/b.json"]);
  expect(ws[0].folderLocale).toBe("ko-KR");
  expect((ws[1].data as any).__parseError).toBeTruthy();
});
test("금지어: 주석·빈 줄 제외", () => {
  expect(loadBanned(repo())).toEqual({ "ko-KR": ["욕1", "욕2"] });
});
test("words 폴더가 없으면 빈 목록", () => {
  expect(loadWords(mkdtempSync(join(tmpdir(), "yk-")))).toEqual([]);
});
