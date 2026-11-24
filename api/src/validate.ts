import { json } from "./http";

export const MAX_BODY_BYTES = 16384;

type Parsed<T> = { ok: true; value: T } | { ok: false; response: Response };

const tooLarge = () => json("TOO_LARGE", 413);
const badRequest = () => json("BAD_REQUEST", 400);

const readCapped = async (request: Request): Promise<string | null> => {
  const declared = request.headers.get("Content-Length");
  if (declared !== null && Number(declared) > MAX_BODY_BYTES) return null;
  if (request.body === null) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
};

export type JsonObject = Record<string, unknown>;

export const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const readJsonObject = async (request: Request): Promise<Parsed<JsonObject>> => {
  const text = await readCapped(request);
  if (text === null) return { ok: false, response: tooLarge() };
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, response: badRequest() };
  }
  if (!isObject(body)) return { ok: false, response: badRequest() };
  return { ok: true, value: body };
};

const ANON_ID = /^[A-Za-z0-9_-]{8,64}$/;
const LOCALE = /^[a-z]{2}-[A-Z]{2}$/;
const APP_VERSION = /^[0-9A-Za-z.+-]{1,32}$/;

export const parseAnonId = (value: unknown): string | null =>
  typeof value === "string" && ANON_ID.test(value) ? value : null;

export const parseLocale = (value: unknown): string | null =>
  typeof value === "string" && LOCALE.test(value) ? value : null;

export const parseHost = (value: unknown): "app" | "browser" | null =>
  value === "app" || value === "browser" ? value : null;

export const parseAppVersion = (value: unknown): string | null =>
  typeof value === "string" && APP_VERSION.test(value) ? value : null;

const DOMAIN_LIKE = /\.[A-Za-z]{2,}/;

const looksLikePii = (word: string): boolean => {
  if (word.includes("@") || word.includes("://") || word.toLowerCase().includes("www.")) return true;
  if (DOMAIN_LIKE.test(word)) return true;
  return (word.match(/\d/g) ?? []).length >= 7;
};

const COMPAT_JAMO = /[\u3130-\u318F]/u;

const normalizeWord = (value: string): string =>
  [...value]
    .map((char) => (COMPAT_JAMO.test(char) ? char : char.normalize("NFKC")))
    .join("")
    .normalize("NFC")
    .replace(/\p{Cf}/gu, "")
    .trim();

export const parseWord = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const word = normalizeWord(value);
  const length = [...word].length;
  if (length < 1 || length > 20) return null;
  return looksLikePii(word) ? null : word;
};

export type Identity = { anonId: string; locale: string; body: JsonObject };

export const readIdentified = async (request: Request): Promise<Parsed<Identity>> => {
  const read = await readJsonObject(request);
  if (!read.ok) return read;
  const anonId = parseAnonId(read.value.anonId);
  const locale = parseLocale(read.value.locale);
  if (anonId === null || locale === null) return { ok: false, response: badRequest() };
  return { ok: true, value: { anonId, locale, body: read.value } };
};

export const readWordRequest = async (
  request: Request,
): Promise<Parsed<{ anonId: string; locale: string; word: string }>> => {
  const read = await readIdentified(request);
  if (!read.ok) return read;
  const word = parseWord(read.value.body.word);
  if (word === null) return { ok: false, response: badRequest() };
  return { ok: true, value: { anonId: read.value.anonId, locale: read.value.locale, word } };
};

export { tooLarge, badRequest };
