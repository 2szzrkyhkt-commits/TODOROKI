-- Dedicated D1 database for TODOROKI US Economic Data.
CREATE TABLE IF NOT EXISTS us_series (
  id TEXT PRIMARY KEY, source TEXT NOT NULL, title TEXT NOT NULL,
  unit TEXT NOT NULL, frequency TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
  last_checked_at TEXT, last_success_at TEXT, last_error TEXT
);
CREATE TABLE IF NOT EXISTS us_observations (
  series_id TEXT NOT NULL, period TEXT NOT NULL, value REAL NOT NULL,
  updated_at TEXT NOT NULL, PRIMARY KEY(series_id,period)
);
CREATE INDEX IF NOT EXISTS idx_us_observations_period ON us_observations(period);
CREATE TABLE IF NOT EXISTS us_runs (
  id TEXT PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT,
  status TEXT NOT NULL, details TEXT
);
