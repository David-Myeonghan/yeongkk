export type EventRow = {
  receivedAt: string;
  day: string;
  anonId: string;
  name: string;
  locale: string;
  host: "app" | "browser";
  appVersion: string | null;
  props: string | null;
};

export const insertEvents = async (env: Env, rows: EventRow[]): Promise<void> => {
  if (rows.length === 0) return;
  const insert = env.DB.prepare(
    "INSERT INTO events (received_at, day, anon_id, name, locale, host, app_version, props) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  await env.DB.batch(
    rows.map((r) => insert.bind(r.receivedAt, r.day, r.anonId, r.name, r.locale, r.host, r.appVersion, r.props)),
  );
};

export type ReportRow = {
  receivedAt: string;
  day: string;
  locale: string;
  word: string;
  anonId: string;
};

export const insertReport = async (env: Env, r: ReportRow): Promise<void> => {
  await env.DB.prepare("INSERT INTO reports (received_at, day, locale, word, anon_id) VALUES (?, ?, ?, ?, ?)")
    .bind(r.receivedAt, r.day, r.locale, r.word, r.anonId)
    .run();
};

export const countReportsSince = async (env: Env, anonId: string, day: string): Promise<number> => {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM reports WHERE anon_id = ? AND day >= ?")
    .bind(anonId, day)
    .first<{ n: number }>();
  return row?.n ?? 0;
};
