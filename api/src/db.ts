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

export const insertReportWithinLimit = async (env: Env, r: ReportRow, limit: number): Promise<boolean> => {
  const result = await env.DB.prepare(
    `INSERT INTO reports (received_at, day, locale, word, anon_id)
     SELECT ?1, ?2, ?3, ?4, ?5
     WHERE (SELECT COUNT(*) FROM reports WHERE anon_id = ?5 AND day = ?2) < ?6`,
  )
    .bind(r.receivedAt, r.day, r.locale, r.word, r.anonId, limit)
    .run();
  return result.meta.changes > 0;
};

export type DayStats = {
  day: string;
  opened: number;
  started: number;
  completed: number;
  shared: number;
  returnedNextDay: number;
};

export type Stats = {
  days: DayStats[];
  experiments: { id: string; variant: string; exposed: number; completed: number; shared: number }[];
  hosts: { host: string; appVersion: string; opened: number }[];
  shareVia: Record<string, number>;
  shareAttempts: Record<string, number>;
};

export const readStats = async (env: Env, from: string, to: string): Promise<Stats> => {
  const funnel = env.DB.prepare(
    `SELECT day,
       COUNT(DISTINCT CASE WHEN name = 'app_open' THEN anon_id END) AS opened,
       COUNT(DISTINCT CASE WHEN name = 'round_start' THEN anon_id END) AS started,
       COUNT(DISTINCT CASE WHEN name = 'round_complete' THEN anon_id END) AS completed,
       COUNT(DISTINCT CASE WHEN name = 'share_done' AND json_extract(props, '$.completed') = 1 THEN anon_id END) AS shared
     FROM events WHERE day BETWEEN ? AND ? GROUP BY day ORDER BY day`,
  ).bind(from, to);
  const returned = env.DB.prepare(
    `SELECT a.day AS day, COUNT(DISTINCT a.anon_id) AS n
     FROM events a
     WHERE a.name = 'app_open' AND a.day BETWEEN ? AND ?
       AND EXISTS (
         SELECT 1 FROM events b
         WHERE b.anon_id = a.anon_id AND b.name = 'app_open' AND b.day = date(a.day, '+1 day')
       )
     GROUP BY a.day`,
  ).bind(from, to);
  const experiments = env.DB.prepare(
    `SELECT x.id AS id, x.variant AS variant, COUNT(*) AS exposed,
       SUM(EXISTS (
         SELECT 1 FROM events c
         WHERE c.anon_id = x.anon_id AND c.name = 'round_complete' AND c.day BETWEEN ?1 AND ?2
           AND json_extract(c.props, '$.exp') = x.id AND json_extract(c.props, '$.variant') = x.variant
       )) AS completed,
       SUM(EXISTS (
         SELECT 1 FROM events s
         WHERE s.anon_id = x.anon_id AND s.name = 'share_done' AND json_extract(s.props, '$.completed') = 1 AND s.day BETWEEN ?1 AND ?2
           AND json_extract(s.props, '$.exp') = x.id AND json_extract(s.props, '$.variant') = x.variant
       )) AS shared
     FROM (
       SELECT DISTINCT json_extract(props, '$.exp') AS id, json_extract(props, '$.variant') AS variant, anon_id
       FROM events
       WHERE name = 'experiment_exposure' AND day BETWEEN ?1 AND ?2
         AND json_type(props, '$.exp') = 'text' AND json_type(props, '$.variant') = 'text'
     ) x
     GROUP BY x.id, x.variant ORDER BY x.id, x.variant`,
  ).bind(from, to);
  const hosts = env.DB.prepare(
    `SELECT host, COALESCE(app_version, '') AS appVersion, COUNT(DISTINCT anon_id) AS opened
     FROM events WHERE name = 'app_open' AND day BETWEEN ? AND ?
     GROUP BY host, COALESCE(app_version, '') ORDER BY host, appVersion`,
  ).bind(from, to);
  const shareVia = env.DB.prepare(
    `SELECT json_extract(props, '$.via') AS via, COUNT(*) AS n
     FROM events
     WHERE name = 'share_done' AND json_extract(props, '$.completed') = 1
       AND day BETWEEN ? AND ? AND json_type(props, '$.via') = 'text'
     GROUP BY via`,
  ).bind(from, to);
  const shareAttempts = env.DB.prepare(
    `SELECT json_extract(props, '$.via') AS via, COUNT(*) AS n
     FROM events
     WHERE name = 'share_done' AND day BETWEEN ? AND ? AND json_type(props, '$.via') = 'text'
     GROUP BY via`,
  ).bind(from, to);

  const [f, r, e, h, v, a] = await env.DB.batch<Record<string, string | number>>([
    funnel, returned, experiments, hosts, shareVia, shareAttempts,
  ]);
  const returnedByDay = new Map((r?.results ?? []).map((row) => [String(row.day), Number(row.n)]));
  return {
    days: (f?.results ?? []).map((row) => ({
      day: String(row.day),
      opened: Number(row.opened),
      started: Number(row.started),
      completed: Number(row.completed),
      shared: Number(row.shared),
      returnedNextDay: returnedByDay.get(String(row.day)) ?? 0,
    })),
    experiments: (e?.results ?? []).map((row) => ({
      id: String(row.id),
      variant: String(row.variant),
      exposed: Number(row.exposed),
      completed: Number(row.completed),
      shared: Number(row.shared),
    })),
    hosts: (h?.results ?? []).map((row) => ({
      host: String(row.host),
      appVersion: String(row.appVersion),
      opened: Number(row.opened),
    })),
    shareVia: Object.fromEntries((v?.results ?? []).map((row) => [String(row.via), Number(row.n)])),
    shareAttempts: Object.fromEntries((a?.results ?? []).map((row) => [String(row.via), Number(row.n)])),
  };
};
