type Handler = (request: Request, env: Env) => Response | Promise<Response>;

const routes: Record<string, Partial<Record<string, Handler>>> = {
  "/api/health": { GET: () => new Response("ok") },
};

const json = (code: string, status: number) => Response.json({ code }, { status });

const allowedOrigins = (env: Env): string[] =>
  env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter((origin) => origin !== "");

const isForbiddenOrigin = (request: Request, env: Env): boolean => {
  const origin = request.headers.get("Origin");
  if (request.method !== "POST" || origin === null) return false;
  return origin !== new URL(request.url).origin && !allowedOrigins(env).includes(origin);
};

export default {
  fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (isForbiddenOrigin(request, env)) return json("FORBIDDEN_ORIGIN", 403);
    const route = routes[pathname];
    if (route === undefined) return json("NOT_FOUND", 404);
    const handler = route[request.method];
    if (handler === undefined) return json("METHOD_NOT_ALLOWED", 405);
    return handler(request, env);
  },
} satisfies ExportedHandler<Env>;
