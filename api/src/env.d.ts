declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import("./index");
  }
  interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
    ALLOWED_ORIGINS: string;
    STATS_TOKEN: string;
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}

type Env = Cloudflare.Env;
