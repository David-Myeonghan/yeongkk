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
