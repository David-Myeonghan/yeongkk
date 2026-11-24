import { readStats } from "./db";
import { json, type Handler } from "./http";
import { badRequest } from "./validate";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 92;

const digest = async (text: string): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

const isAuthorized = async (request: Request, env: Env): Promise<boolean> => {
  const token = env.STATS_TOKEN;
  if (typeof token !== "string" || token === "") return false;
  const header = request.headers.get("Authorization") ?? "";
  const match = /^bearer ([^\s]+)$/i.exec(header);
  if (match === null) return false;
  const [given, expected] = await Promise.all([digest(match[1]), digest(token)]);
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= given[i] ^ expected[i];
  return diff === 0;
};

const parseDay = (value: string | null): number | null => {
  if (value === null || !DAY.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== value ? null : ms;
};

export const getStats: Handler = async (request, env) => {
  if (!(await isAuthorized(request, env))) return json("UNAUTHORIZED", 401);
  const params = new URL(request.url).searchParams;
  const from = params.get("from");
  const to = params.get("to");
  const fromMs = parseDay(from);
  const toMs = parseDay(to);
  if (from === null || to === null || fromMs === null || toMs === null) return badRequest();
  if (fromMs > toMs || (toMs - fromMs) / DAY_MS + 1 > MAX_RANGE_DAYS) return badRequest();
  const stats = await readStats(env, from, to);
  return Response.json(stats, { headers: { "Cache-Control": "no-store" } });
};
