import type { LoadedWord, Problem, Word } from "./types";
import { validateWordSchema } from "./schema";

export const norm = (s: string) => s.normalize("NFC").replace(/\s+/g, "").toLowerCase();
const P = (file: string, rule: string, message: string): Problem => ({ file, rule, message });

export function checkFormat(w: LoadedWord): Problem[] {
  const out: Problem[] = [];
  const d = w.data as any;
  if (d && d.__parseError) return [P(w.path, "형식", `JSON 아님: ${d.__parseError}`)];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*\.json$/.test(w.fileName)) out.push(P(w.path, "형식", "파일 이름은 영문 소문자·숫자·- 만"));
  const r = validateWordSchema(d);
  if (!r.ok) { for (const e of r.errors) out.push(P(w.path, "형식", e)); return out; }
  if (d.locale !== w.folderLocale) out.push(P(w.path, "형식", `폴더 로케일 ${w.folderLocale} ≠ 파일 locale ${d.locale}`));
  if (`${d.id}.json` !== w.fileName) out.push(P(w.path, "형식", `파일 이름 ≠ id(${d.id})`));
  return out;
}

export interface Valid { path: string; word: Word }
export function checkDuplicates(ws: Valid[]): Problem[] {
  const seen = new Map<string, string>(); const out: Problem[] = [];
  for (const { path, word } of [...ws].sort((a, b) => a.path.localeCompare(b.path))) {
    const k = `${word.locale}\u0000${norm(word.word)}`;
    const first = seen.get(k);
    if (first) out.push(P(path, "중복", `「${word.word}」 이미 있음: ${first}`)); else seen.set(k, path);
  }
  return out;
}

export function platformOf(url: string): string {
  let host: string;
  try { host = new URL(url).hostname.replace(/^(www|m)\./, ""); } catch { return "invalid"; }
  if (host === "youtube.com" || host === "youtu.be") return "youtube";
  if (host === "instagram.com") return "instagram";
  if (host === "tiktok.com") return "tiktok";
  return `other:${host}`;
}
export function checkSources(ws: Valid[]): Problem[] {
  return ws.flatMap(({ path, word }) => {
    const ps = new Set(word.sources.map(platformOf).filter(p => p !== "invalid"));
    return ps.size >= 2 ? [] : [P(path, "출처", `서로 다른 플랫폼 2개 이상 필요 (지금 ${[...ps].join(", ") || "없음"})`)];
  });
}

export function checkBanned(ws: Valid[], banned: Record<string, string[]>): Problem[] {
  return ws.flatMap(({ path, word }) => {
    const text = norm([word.word, word.meaning, word.origin ?? "", ...word.examples, ...word.funnyWrong].join(" "));
    const hit = (banned[word.locale] ?? []).filter(b => text.includes(norm(b)));
    return hit.length ? [P(path, "금지어", `금지어 포함: ${hit.join(", ")}`)] : [];
  });
}

export function checkQuiz(ws: Valid[]): Problem[] {
  return ws.flatMap(({ path, word }) => {
    const out: Problem[] = []; const m = norm(word.meaning);
    if (word.funnyWrong.some(f => norm(f) === m)) out.push(P(path, "퀴즈", "웃긴 오답이 뜻과 같음"));
    word.examples.forEach((e, i) => { if (!norm(e).includes(norm(word.word))) out.push(P(path, "퀴즈", `예문 ${i + 1} 에 「${word.word}」 없음`)); });
    if (m === norm(word.word)) out.push(P(path, "퀴즈", "뜻이 말과 같음"));
    return out;
  });
}
