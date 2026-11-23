# TODOROKI Command Center — operational boundaries

This PR is a **read-only foundation**, not an autonomous software engineer.

## Current pipeline
- Canonical TODO: `docs/TODOROKI-TODO.md` (never edited by this workflow).
- Snapshot: `tools/command-center/snapshot.py`, includes review-only priority classification.
- UI: `tools/command-center/dashboard.py` generates offline HTML.
- Evidence: `command-center-results/{snapshot.json,index.html}`, uploaded as Actions artifacts.
- Trigger: manual `workflow_dispatch` only until quotas, audit overlap and end-to-end behavior are verified.
- Deployment: none; the generated HTML is not an authenticated hosted application.
- No code writing, PR merging, Cloudflare access or self-execution is performed.

## Activation checklist
1. Run all unit tests and snapshot generator on a clean checkout of this PR.
2. Verify snapshot counts against the canonical TODO, including explicitly excluded tasks.
3. Open the HTML on desktop and narrow viewport; check search and escaping.
4. Run the workflow on main **after review and merge**; verify artifact download and JSON/HTML integrity.
5. Inspect GitHub Actions billing/quota and existing audit workflows; only then consider scheduled execution.
6. Define explicit allowlisted low-risk action types, branch protections, evidence-backed approvals, rollback and run limits.
7. Validate one real low-risk task end-to-end before claiming autonomous operation.

## Safety
- Task title keyword matching is not sufficient to authorize a change.
- Approval flags are false unless independently verified; no automatic inference.
- Do not publish private TODO data on a public Cloudflare URL.
- Do not mark a TODO complete from a successful snapshot.
- Avoid changing existing site, data, secrets, permissions or billing.
