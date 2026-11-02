# US Equity Lab — deployment checklist (prototype)

This project is separate from the Japanese EDINET tool. Do not deploy to the existing production worker.

1. Create a NEW Cloudflare D1 database, named `todoroki-us-equity`.
2. Create a NEW Worker named `todoroki-us-equity-api`, entry point `us-equity/worker.js`.
3. Bind the new D1 database as `DB`. Run `us-equity/schema.sql` against that database.
4. Configure secrets `SEC_USER_AGENT` (real app identity and contact email) and `ADMIN_TOKEN` (long random secret).
5. Configure cron trigger `*/5 * * * *` for incremental ingestion. This is not guaranteed to complete every five minutes and must respect Cloudflare plan limits.
6. Authenticate POST `/admin/refresh-tickers` once to initialize the issuer queue. Then scheduled jobs collect three issuers per run.
7. Verify `/api/status`, `/api/companies?q=AAPL`, `/api/annual?cik=320193` and compare with SEC filings before using figures in valuation.

**Not yet production ready:** Companyfacts annual-fact selection can mix amended/comparative values and has no consolidated fiscal-period reconciliation; verify period alignment and deduplicate by accession. SEC's company ticker exchange file does not reliably provide Nasdaq tier or ordinary-share classification; a separate exchange security master is needed. Current schema stores one chosen observation per year/concept/unit, not all historical amendments. The front-end preview uses direct SEC requests and is not yet wired to this worker. The API's annual endpoint has a 5,000-row cap; add pagination. Cloudflare Worker CPU/time, D1 write quotas, and SEC fair-access policy require load testing before mass collection. No D1 resource, Worker deployment, live ingestion, or live site has been created by this commit.
