-- TODOROKI US Equity Lab: isolated database, not shared with EDINET.
CREATE TABLE IF NOT EXISTS issuers (
 cik TEXT PRIMARY KEY,
 ticker TEXT NOT NULL,
 name TEXT NOT NULL,
 exchange TEXT,
 market_tier TEXT,
 security_type TEXT,
 active INTEGER DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS issuers_ticker ON issuers(ticker);
CREATE INDEX IF NOT EXISTS issuers_exchange ON issuers(exchange);
CREATE TABLE IF NOT EXISTS annual_facts (
 cik TEXT NOT NULL,
 fiscal_year INTEGER NOT NULL,
 fiscal_period_end TEXT NOT NULL,
 concept TEXT NOT NULL,
 taxonomy TEXT NOT NULL,
 unit TEXT NOT NULL,
 value REAL NOT NULL,
 accession TEXT NOT NULL,
 filed_at TEXT NOT NULL,
 form TEXT NOT NULL,
 source_start TEXT,
 source_end TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(cik,fiscal_year,concept,taxonomy,unit)
);
CREATE INDEX IF NOT EXISTS annual_facts_cik_year ON annual_facts(cik,fiscal_year);
CREATE TABLE IF NOT EXISTS collection_jobs (
 cik TEXT PRIMARY KEY,
 status TEXT NOT NULL DEFAULT 'pending',
 attempts INTEGER NOT NULL DEFAULT 0,
 last_error TEXT,
 last_attempt_at TEXT,
 completed_at TEXT,
 FOREIGN KEY(cik) REFERENCES issuers(cik)
);
