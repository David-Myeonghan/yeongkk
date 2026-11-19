import { createInterface } from "node:readline/promises";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { makeWord } from "./add-word-core";
import { loadWords, loadBanned } from "./load";
import { runAll, toMarkdown } from "./validate";

if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()) {
  console.error("작업 중인 변경이 있음 — 커밋하거나 치운 뒤 다시");
  process.exit(1);
}
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string) => rl.question(q);
const list = async (q: string) => (await ask(`${q} (| 로 구분): `)).split("|").map(s => s.trim()).filter(Boolean);
const locale = (await ask("로케일 [ko-KR]: ")) || "ko-KR";
const a = {
  word: await ask("말: "), id: await ask("id (영문 소문자·숫자·-): "), meaning: await ask("뜻: "),
  examples: await list("예문 2개 이상"), origin: await ask("유래 (없으면 엔터): "),
  funnyWrong: await list("웃긴 오답"), sources: await list("출처 주소 2개 이상 (서로 다른 플랫폼)"),
};
rl.close();
if (!/^[a-z]{2}-[A-Z]{2}$/.test(locale) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.id)) {
  console.error("로케일(예: ko-KR) 또는 id(영문 소문자·숫자·-) 형식이 틀림");
  process.exit(1);
}
const path = `words/${locale}/${a.id}.json`;
writeFileSync(path, JSON.stringify(makeWord(a, locale, new Date().toISOString().slice(0, 10)), null, 2) + "\n");
const ps = runAll({ words: loadWords("."), banned: loadBanned("."), changedFiles: [path], deletedFiles: [], isBot: false, root: "." });
console.log(toMarkdown(ps));
if (ps.length) process.exit(1);
const git = (...args: string[]) => execFileSync("git", args, { stdio: "inherit" });
git("switch", "-c", `add/${locale}/${a.id}`);
git("add", path);
git("commit", "-m", `word(${locale}): ${a.word}`);
git("push", "-u", "origin", "HEAD");
execFileSync("gh", ["pr", "create", "--fill", "--base", "main"], { stdio: "inherit" });
