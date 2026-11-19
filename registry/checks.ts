import type { LoadedWord, Problem, Word } from "./types";
import { validateWordSchema } from "./schema";

export const normKey = (s: string) => s.normalize("NFKC").replace(/[\s\p{Cf}]/gu, "").toLowerCase();
export const normText = (s: string) => s.normalize("NFKC").replace(/\p{Cf}/gu, "").replace(/\s+/g, " ").toLowerCase();
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
export function checkDuplicates(ws: Valid[], changedFiles: string[]): Problem[] {
  const changed = new Set(changedFiles);
  const rank = (v: Valid) => [Number(changed.has(v.path)), Number(v.word.status === "retired")];
  const seen = new Map<string, string>(); const out: Problem[] = [];
  const sorted = [...ws].sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    return ra[0] - rb[0] || ra[1] - rb[1] || a.path.localeCompare(b.path);
  });
  for (const { path, word } of sorted) {
    const k = `${word.locale}\u0000${normKey(word.word)}`;
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
const ALLOWED = new Set(["youtube", "instagram", "tiktok"]);
export function checkSources(ws: Valid[]): Problem[] {
  return ws.flatMap(({ path, word }) => {
    const out: Problem[] = [];
    for (const u of word.sources) if (!ALLOWED.has(platformOf(u))) out.push(P(path, "출처", `허용 안 된 출처: ${u}`));
    const ps = new Set(word.sources.map(platformOf).filter(p => ALLOWED.has(p)));
    if (ps.size < 2) out.push(P(path, "출처", `서로 다른 플랫폼 2개 이상 필요 (지금 ${[...ps].join(", ") || "없음"})`));
    return out;
  });
}

export function checkBanned(ws: Valid[], banned: Record<string, string[]>): Problem[] {
  return ws.flatMap(({ path, word }) => {
    const fields = [word.word, word.meaning, word.origin ?? "", ...word.examples, ...word.funnyWrong].map(normText);
    const hit = (banned[word.locale] ?? []).filter(b => { const nb = normText(b); return nb !== "" && fields.some(f => f.includes(nb)); });
    return hit.length ? [P(path, "금지어", `금지어 포함: ${hit.join(", ")}`)] : [];
  });
}

export function checkQuiz(ws: Valid[]): Problem[] {
  return ws.flatMap(({ path, word }) => {
    const out: Problem[] = []; const m = normKey(word.meaning);
    const k = normKey(word.word);
    const needles = k.length >= 3 && k.endsWith("다") ? [k, k.slice(0, -1)] : [k];
    if (word.funnyWrong.some(f => normKey(f) === m)) out.push(P(path, "퀴즈", "웃긴 오답이 뜻과 같음"));
    word.examples.forEach((e, i) => { const ek = normKey(e); if (!needles.some(n => ek.includes(n))) out.push(P(path, "퀴즈", `예문 ${i + 1} 에 「${word.word}」 없음`)); });
    if (m === k) out.push(P(path, "퀴즈", "뜻이 말과 같음"));
    return out;
  });
}

const PII: [string, RegExp][] = [
  ["이메일", /[\w.+-]+@[\w-]+\.[\w.-]+/],
  ["@아이디", /(^|[^\w.])@[A-Za-z][A-Za-z0-9_.]{1,}/],
  ["전화번호", /(?<!\d)(?:\+82[-\s]?|0)1[016789]\s*[-.]?\s*\d{3,4}\s*[-.]?\s*\d{4}(?!\d)/],
];
function contentUrlOk(u: string): boolean {
  let url: URL;
  try { url = new URL(u); } catch { return false; }
  if (url.username || url.password) return false;
  const host = url.hostname.replace(/^(www|m)\./, ""); const p = url.pathname;
  if (p.includes("/@")) return false;
  if (host === "youtube.com") return (p === "/watch" && !!url.searchParams.get("v")) || /^\/shorts\/[\w-]{11}\/?$/.test(p);
  if (host === "youtu.be") return /^\/[\w-]{11}\/?$/.test(p);
  if (host === "instagram.com") return /^\/(p|reel)\/[\w-]+\/?$/.test(p);
  if (host === "tiktok.com") return /^\/tag\/[^/]+\/?$/.test(p);
  return true;
}
export function checkPII(ws: Valid[]): Problem[] {
  return ws.flatMap(({ path, word }) => {
    const out: Problem[] = [];
    const texts = [word.meaning, word.origin ?? "", ...word.examples, ...word.funnyWrong].map(t => t.normalize("NFKC"));
    for (const [name, re] of PII) if (texts.some(t => re.test(t))) out.push(P(path, "개인정보", `${name} 들어 있음`));
    for (const u of word.sources) {
      if (!ALLOWED.has(platformOf(u))) continue;
      if (!contentUrlOk(u)) out.push(P(path, "개인정보", `콘텐츠 주소만 허용(계정 주소 금지): ${u}`));
    }
    return out;
  });
}

const BOT_FILE = /^words\/[a-z]{2}-[A-Z]{2}\/[a-z0-9]+(-[a-z0-9]+)*\.json$/;
export function checkScope(changed: string[], deleted: string[], isBot: boolean): Problem[] {
  if (!isBot) return [];
  return [
    ...changed.filter(f => !BOT_FILE.test(f)).map(f => P(f, "변경 범위", "봇 PR 은 words/<로케일>/<id>.json 만 바꿀 수 있음")),
    ...deleted.map(f => P(f, "변경 범위", "봇 PR 은 파일을 지울 수 없음")),
  ];
}
