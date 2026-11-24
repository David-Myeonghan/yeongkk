export type Now = () => number;
export type Handler = (request: Request, env: Env, now: Now) => Response | Promise<Response>;

export const json = (code: string, status: number) => Response.json({ code }, { status });

export const noContent = () => new Response(null, { status: 204 });
