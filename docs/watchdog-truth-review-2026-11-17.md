# T45: do not report an unhealthy monitor as healthy

The independent watchdog template could record `heartbeat.ok=true` after a
non-successful site HTTP response or after detecting a stale scheduled audit.
It also accepted future timestamps, and an invalid audit timestamp could make
the old comparison treat an audit as fresh. These were source-code defects;
the independent Worker has not been deployed, so this is not a claim that a
running production watchdog has been repaired.

Changes:

- A completed successful `schedule` run on `main` is required, with a finite
  timestamp from the preceding three hours. Push/other-branch/in-progress runs
  do not substitute for a scheduled success.
- `check()` returns its health result. A site HTTP failure or stale audit creates
  a failed heartbeat and bounded failure history, instead of a healthy heartbeat.
- `/health` returns an uncached 503 for missing, invalid, future, stale or failed
  heartbeats and unavailable storage. Only boolean `ok=true` qualifies as healthy.
- Existing stale-alert deduplication, recovery/recurrence and retry-after-failed-
  delivery behavior remain. A site HTTP failure now appears in health/history;
  this change does not add site-failure alerts or full-project monitoring.

Verification: 26 isolated Node tests use synthetic storage, responses and an
intercepted fetch. Unknown exception details are neither stored nor rethrown;
corrupt history cannot prevent a failed heartbeat. Storage errors still reject
execution and do not become a success. No real webhook, mail, production data write, authentication
change or new periodic task. Tests cover the false-health defects, notification
failure, retry bounds, 30-entry retention and omitted upstream response bodies.
The existing quality workflow runs this test file; no workflow job/Cron is added.

Source lives under `/tools/**`, excluded from website assets. Main integration
and the website build do not deploy the independent watchdog. T45 stays open:
full-project monitoring, approved existing scheduling/notification integration,
runtime health and independent suspension detection remain unverified.

## T43 read-only deployment metadata review

On 2026-11-17, listed the ten existing Workers and read their settings, returning
binding names/types only, never plain-text values or secret values. All ten reads
succeeded, comprising 33 bindings including 15 `secret_text` bindings.

|Worker|All bindings|Secret bindings|
|---|---:|---:|
|todoroki|9|4|
|todoroki-edgar-cron|1|1|
|todoroki-edinet-cron|4|2|
|todoroki-japan-support-dev|4|0|
|todoroki-life-ops|2|1|
|todoroki-slot|4|3|
|todoroki-slot-collector|1|0|
|todoroki-slot-staging|4|1|
|todoroki-tax-cron|2|1|
|todoroki-us-economy-cron|2|2|

Secret binding type is not evidence of token scope, minimum privilege, expiration
or credential validity. The token-verification endpoint returned 401 and no
metadata; no token-detail read was attempted without a verified identifier.
Worker settings reads still succeeded, so this endpoint failure does not prove
that all Cloudflare access is broken. Do not retry it indefinitely or broaden
permissions. GitHub account/token-secret APIs are unavailable through the
connected repository tool. T43 stays open for unavailable policy verification
and broader history/deployment checks. No permission or access-control change.
