# EDINET archive collector — deployment checklist

This is an **isolated prototype**, not yet deployed. Do not point TODOROKI's existing route at it until tested.

## Cloudflare resources
1. Create a dedicated D1 database and execute `equity/edinet-archive-schema.sql`.
2. Create a private R2 bucket for source ZIP documents. Confirm R2 availability and billing before enabling a decade-scale crawl.
3. Create a dedicated Worker using `equity/edinet-archive-worker.js`. Bind D1 as `EDINET_DB` and R2 as `EDINET_FILES`.
4. Add secrets `EDINET_API_KEY` and a strong random `ADMIN_TOKEN`. Never expose these to the browser or commit them.
5. Set a Cron Trigger to `* * * * *` and configure Worker observability. Monitor costs, storage, quota and errors.
6. Use an authenticated POST to `/start` with a date range such as `{"from":"2016-11-02","to":"2026-11-02"}`. `/status` reports progress.
7. Inspect error counts and request `POST /retry-failed` if needed. A job will not mark complete while failed records remain.

## Limitations / before production
- The code saves EDINET annual-report and amendment ZIP files; it does **not** yet parse XBRL or populate 126 financial fields.
- The initial document filter is docTypeCode 120/130; validate official document types, company scope, amendment handling, and availability before relying on completeness.
- The current worker performs a limited amount of work per cron invocation; benchmark D1, R2, API response and CPU/memory limits.
- Failed document retries require an explicit authenticated call; automatic retry orchestration is not yet complete.
- No public URL, scheduled collection or actual retrieval has been verified. Do not claim collection is running.
- Protect the API key: this prototype passes it in EDINET's documented query parameter; verify API requirements and avoid logging request URLs.
- Verify rate limits, archival availability, costs, and applicable terms with EDINET and Cloudflare.
