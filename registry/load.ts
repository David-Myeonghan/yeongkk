import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { LoadedWord } from "./types";

export const LOCALE_DIR = /^[a-z]{2}-[A-Z]{2}$/;

export const dirs = (p: string) => existsSync(p) ? readdirSync(p, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name) : [];

export function loadWords(root: string): LoadedWord[] {
  const out: LoadedWord[] = [];
  for (const locale of dirs(join(root, "words"))) {
    for (const fileName of readdirSync(join(root, "words", locale)).filter(f => f.endsWith(".json"))) {
      const path = `words/${locale}/${fileName}`;
      let data: unknown;
      try { data = JSON.parse(readFileSync(join(root, path), "utf8")); }
      catch (e) { data = { __parseError: String(e) }; }
      out.push({ path, folderLocale: locale, fileName, data });
    }
  }
  return out;
}

export function loadBanned(root: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const locale of dirs(join(root, "config"))) {
    const f = join(root, "config", locale, "banned.txt");
    if (!existsSync(f)) continue;
    out[locale] = readFileSync(f, "utf8").split("\n").map(s => s.trim()).filter(s => s && !s.startsWith("#"));
  }
  return out;
}
