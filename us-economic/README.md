# US economic ingestion — deployment guide

This standalone Worker does not change the existing US economic tool or the main TODOROKI site.

Deployment is NOT complete.

1. Create a dedicated D1 database named todoroki-us-economic in Cloudflare.
2. Copy wrangler.toml.example to wrangler.toml and replace the placeholder D1 database ID.
3. From this directory, apply schema.sql to that remote D1 database.
4. Deploy worker.js with Wrangler. Verify the daily 02:15 UTC Cron Trigger.
5. Check the health endpoint and inspect D1 tables us_runs, us_series and us_observations after the first scheduled execution.
6. Verify the two BLS monthly series (CPI-U CUUR0000SA0 and unemployment LNS14000000) in the public read endpoint.
7. Connect the existing economic tool only after finding and reviewing its own code and deployment.

Current limitations: only two monthly BLS series, rolling two-year ingestion, no 10–30-year backfill, no complete revision audit, no alert delivery. CORS is not authentication. Do not expose private data via the read endpoint. Existing site routing and login gate are unchanged.