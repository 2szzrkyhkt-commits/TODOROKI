CREATE TABLE IF NOT EXISTS support_attempts (id TEXT PRIMARY KEY, amount INTEGER NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE TABLE IF NOT EXISTS support_limits (id TEXT PRIMARY KEY, hits INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS support_events (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, event_type TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE TABLE IF NOT EXISTS support_payments (session_id TEXT PRIMARY KEY, amount INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','paid','failed')), created_at INTEGER NOT NULL DEFAULT (unixepoch()));
