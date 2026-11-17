# T45: existing production notification path

The current quality workflow already uses `notify.py` to create GitHub issues,
and `persist.py` to retain the report in `quality-history`. This change updates
that existing path, rather than creating another monitor, webhook, account,
secret, workflow job, Cron or Automation. GitHub repository permissions stay
unchanged. It does not deploy or activate the independent watchdog template.

## Incident dispatch

- External reference failures (TQ20), including 404 and transient 502, stay in
  the audit's errors/findings/classification for routine review. An external
  reference failure alone is not an outage of a TODOROKI service, so it no longer
  creates an immediate incident issue. Existing issues are not closed or deleted.
- All other previously selected incident categories remain eligible. Generation
  and dispatch share one policy; dispatch also checks older persisted reports,
  so an old TQ20 candidate cannot bypass the new policy.
- Public issue bodies contain only the validated criterion ID, incident
  fingerprint and repository/run reference. They do not copy arbitrary URL query
  strings, credentials in URLs, fetched bodies or provider error text.
- Existing fingerprint markers still suppress duplicate open issues, even if
  their old bodies contain more detail. Healthy runs do not call the issue API.
  A failed delivery still fails the step, and is not counted as delivered.

## Recovery state

Previously, an old error disappearing from the error list was treated as
recovered, even when the next request returned 403 or a network failure.
`unverified_findings` now retains such known incidents separately from current
verified errors. A current positive check with no inconclusive evidence is
required to record recovery. Checks not run in the current cadence cannot
resolve an old incident. Pending incidents survive multiple reports, do not
create a duplicate alert on reconfirmation, and can resolve after a later
verified success. The summary shows their count without printing their details.
The report's schema remains 1 with an additive field; older reports lacking it
remain readable. This does not reconstruct incidents already lost by old runs.

## Validation and limits

71 Python tests pass, including ten new tests for legacy candidate rejection,
detail-free issue formatting, compatible deduplication, invalid input, failed
delivery, ledger retention and failure -> unknown -> unknown -> recovery.
Tests intercept `gh`, use synthetic data and make no real incident notifications.
The existing 26 watchdog tests are unchanged and run in the existing CI.

Production verification must separately confirm the main workflow's notification
step and durable readback. A successful notification decision with no candidates
means no issue was needed; it is not an actual delivery test. Full-project private
collector status, independent monitoring/suspension detection and end-user inbox
receipt remain outside this change. T45 stays incomplete until its whole scope
is verified. T43's unavailable token-policy details are still a separate blocker.
