import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadWords } from "./load";
import { checkFormat } from "./checks";
import { buildLocale } from "./build";
import type { Word } from "./types";

export function writeBuild(root: string, outDir: string): string[] {
  const ws = loadWords(root);
  const bad = ws.flatMap(checkFormat);
  if (bad.length) throw new Error(`형식 틀린 파일 ${bad.length}건: ${bad.map(b => `${b.file} ${b.message}`).join("; ")}`);
  const words = ws.map(w => w.data as Word);
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const locale of new Set(ws.map(w => w.folderLocale))) {
    const f = join(outDir, `words.${locale}.json`);
    writeFileSync(f, JSON.stringify(buildLocale(words, locale)));
    written.push(f);
  }
  writeFileSync(join(outDir, "index.html"), "<!doctype html><meta charset=utf-8><title>영크크</title><p>준비 중</p>");
  written.push(join(outDir, "index.html"));
  return written;
}
