-- Additive T28 metadata only. No existing tables, data or schedules are changed.
CREATE TABLE IF NOT EXISTS support_monitor_latest(entity_key TEXT PRIMARY KEY,state_json TEXT NOT NULL,checked_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS support_monitor_history(id TEXT PRIMARY KEY,entity_key TEXT NOT NULL,state_json TEXT NOT NULL,observed_at TEXT NOT NULL);
