import { postAsk } from "./ask";
import { postEvents } from "./events";
import { postReports } from "./reports";
import { getStats } from "./stats";
import { json, type Handler, type Now } from "./http";

type Routes = Record<string, Partial<Record<string, Handler>>>;

export const routes: Routes = {
  "/api/health": { GET: () => new Response("ok") },
  "/api/events": { POST: postEvents },
  "/api/reports": { POST: postReports },
  "/api/stats": { GET: getStats },
  "/api/ask": { POST: postAsk },
};

const ownValue = <T>(table: Record<string, T>, key: string): T | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined;

const allowedOrigins = (env: Env): string[] =>
  env.ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter((origin) => origin !== "");

const isForbiddenOrigin = (request: Request, env: Env): boolean => {
  const origin = request.headers.get("Origin");
  if (request.method !== "POST" || origin === null) return false;
  return origin !== new URL(request.url).origin && !allowedOrigins(env).includes(origin);
};

const handleApi = async (request: Request, env: Env, table: Routes, now: Now): Promise<Response> => {
  if (isForbiddenOrigin(request, env)) return json("FORBIDDEN_ORIGIN", 403);
  const route = ownValue(table, new URL(request.url).pathname);
  if (route === undefined) return json("NOT_FOUND", 404);
  if (request.method === "HEAD" && ownValue(route, "HEAD") === undefined) {
    const get = ownValue(route, "GET");
    if (get !== undefined) {
      const res = await get(request, env, now);
      return new Response(null, { status: res.status, headers: res.headers });
    }
  }
  const handler = ownValue(route, request.method);
  if (handler === undefined) return json("METHOD_NOT_ALLOWED", 405);
  return handler(request, env, now);
};

type Worker = { fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> };

export const createHandler = (table: Routes, now: Now = Date.now): Worker =>
  ({
    async fetch(request, env) {
      if (!new URL(request.url).pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
      try {
        return await handleApi(request, env, table, now);
      } catch (error) {
        console.error("api error", error);
        return json("INTERNAL_ERROR", 500);
      }
    },
  });

export default createHandler(routes);
