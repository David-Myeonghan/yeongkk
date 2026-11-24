CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  received_at TEXT NOT NULL,
  day TEXT NOT NULL,
  anon_id TEXT NOT NULL,
  name TEXT NOT NULL,
  locale TEXT NOT NULL,
  host TEXT NOT NULL,
  app_version TEXT,
  props TEXT
);
CREATE INDEX events_day_name ON events (day, name);
CREATE INDEX events_anon_day ON events (anon_id, day);

CREATE TABLE reports (
  id INTEGER PRIMARY KEY,
  received_at TEXT NOT NULL,
  day TEXT NOT NULL,
  locale TEXT NOT NULL,
  word TEXT NOT NULL,
  anon_id TEXT NOT NULL
);
CREATE INDEX reports_locale_word ON reports (locale, word);
CREATE INDEX reports_anon_day ON reports (anon_id, day);
