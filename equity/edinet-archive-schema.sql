-- Run in a dedicated Cloudflare D1 database before deploying edinet-archive-worker.js.
CREATE TABLE IF NOT EXISTS archive_jobs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 start_date TEXT NOT NULL,
 end_date TEXT NOT NULL,
 cursor TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('running','complete','paused')),
 last_error TEXT
);
CREATE TABLE IF NOT EXISTS archive_docs (
 job_id INTEGER NOT NULL,
 doc_id TEXT NOT NULL,
 submitted_on TEXT NOT NULL,
 doc_type TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','done','failed')),
 attempts INTEGER NOT NULL DEFAULT 0,
 last_error TEXT,
 PRIMARY KEY(job_id,doc_id)
);
CREATE INDEX IF NOT EXISTS idx_archive_docs_state ON archive_docs(job_id,state,submitted_on);
