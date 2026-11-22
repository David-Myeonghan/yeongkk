declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import("./index");
  }
  interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
    ALLOWED_ORIGINS: string;
    STATS_TOKEN: string;
  }
}

type Env = Cloudflare.Env;
