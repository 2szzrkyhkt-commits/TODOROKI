# T43: local credential and generated-file boundaries

The repository had no `.gitignore`. Add local credential/key/database/cache
patterns and exclude generated `quality-results` and private-file types from
static asset uploads. These changes do not remove tracked files, rotate secrets,
change authentication or alter Cloudflare/GitHub token permissions.

Read-only history check on 2026-11-17 examined 9,480 reachable Git objects,
including 4,148 blobs in the fetched local refs. Six known format families
(PEM private keys, GitHub tokens, AWS access-key IDs, Slack tokens, Google API
keys and Stripe secret/restricted keys) had zero matches. The scanner printed
counts/object IDs only, never candidate values. This is a limited format scan,
not proof of absence of secrets: arbitrary/Cloudflare tokens, unknown formats,
entropy, credential validity, remote deleted refs and account permission scope
were not verified. Public IndexNow verification keys are not private credentials.

Existing Actions checkout disables persisted credentials in the quality audit;
the audit job still has contents/issues write for its existing ledger and alerts.
No workflow permissions or account access controls are changed here. T43 stays
incomplete pending the wider permission, deployment and history audit.

Verification: use `git check-ignore --no-index` on synthetic secret/database/cache
paths and normal article/Worker/quality source paths. Check tracked paths against
new deployment patterns to prevent excluding existing site assets. All tests use
path strings; no secret files or real credential values are created.
