import type { CheckContext, Problem, Word } from "./types";
import { checkFormat, checkDuplicates, checkSources, checkBanned, checkQuiz, checkPII, checkScope, type Valid } from "./checks";
import { checkConfig } from "./config";
import { buildLocale } from "./build";
import { writeBuild } from "./write-build";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function runAll(ctx: CheckContext): Problem[] {
  const out: Problem[] = []; const valid: Valid[] = [];
  for (const w of ctx.words) {
    const f = checkFormat(w); out.push(...f);
    if (f.length === 0) valid.push({ path: w.path, word: w.data as Word });
  }
  const configProblems = (ctx.configs ?? []).flatMap(checkConfig);
  out.push(...configProblems);
  out.push(...checkDuplicates(valid, ctx.changedFiles), ...checkSources(valid), ...checkBanned(valid, ctx.banned),
           ...checkQuiz(valid), ...checkPII(valid), ...checkScope(ctx.changedFiles, ctx.deletedFiles, ctx.isBot));
  if (ctx.root !== undefined) {
    if (valid.length === ctx.words.length && configProblems.length === 0) {
      const tmp = mkdtempSync(join(tmpdir(), "yeongkk-build-"));
      try { writeBuild(ctx.root, tmp); }
      catch (e) { out.push({ file: "words", rule: "묶기", message: String(e) }); }
      finally { rmSync(tmp, { recursive: true, force: true }); }
    }
  } else {
    for (const locale of new Set(valid.map(v => v.word.locale))) {
      try { JSON.stringify(buildLocale(valid.map(v => v.word), locale)); }
      catch (e) { out.push({ file: `words/${locale}`, rule: "묶기", message: String(e) }); }
    }
  }
  return out;
}

export function toMarkdown(ps: Problem[]): string {
  if (ps.length === 0) return "✅ 검사 통과";
  return ["❌ 검사 실패 — 합치지 마세요", "", ...ps.map(p => `- **${p.rule}** \`${p.file}\` — ${p.message}`)].join("\n");
}
