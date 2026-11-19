# EDINET production ownership

EDINET Connect remains the sole writer and source of truth. Its existing R2 bucket and encrypted API key are retained. `edinet-cron.js` is a native Cloudflare Cron coordinator; it never downloads filings independently or creates a second queue. The old `edinet-archive-worker.js` is a legacy standalone prototype and must not be deployed concurrently against the same target universe.

## Native execution

Deploy `wrangler.edinet-cron.jsonc` with Cloudflare account authorization. Set `EDINET_CONNECT_TOKEN` as a Cloudflare secret using the existing Connect service credential (not the EDINET API key). Never put the value in source, CLI arguments or logs. The native cron runs every five minutes and invokes up to six bounded batches against Connect. The private Site access boundary and Connect CAS lease prevent competing writes.

Once a native invocation has been observed in Connect's `lastInvoker`, set its `NATIVE_SCHEDULER_CONFIGURED` runtime variable to `true` and deploy that environment revision. Verify another invocation after the operator session has ended. Only then retire EDINET calls from the old ChatGPT task; its unrelated EDGAR behavior is separate.

Connect stores checkpoints per step, backs off on errors, holds a work item after eight failures, retains encrypted credentials after backfill, and checks a rolling recent window after completion. Stopping with key deletion is explicit. The legacy prototype no longer resets failed document attempts indefinitely.

## Publication

Connect verifies stored ZIP SHA-256 hashes and extracts annual facts from EDINET's XBRL-to-CSV, with direct original XBRL support when CSV is unavailable. Raw XBRL archives are retained when available. It writes per-document records, per-company bundles, and source evidence to the existing R2 bucket. Old files are not deleted. Ambiguous/missing values remain held. Corrections require a matching parent chain and scope.

The current analysis Site reads incremental company bundles server-side with its secret Connect credential. It preserves the existing source bundle and evaluation formulas. New document IDs are appended only for companies already allowed for publication; unconfirmed SBI listings remain held. New EPS is not silently treated as split-comparable. Values and evidence are returned together. If the import service fails, the existing dataset remains available.

## Current deployment boundary

The Sites API can deploy Connect and the analysis Site, but does not expose arbitrary Cloudflare Cron Trigger administration. Direct Cloudflare account authorization is required to deploy the native coordinator and its secret. Saving a ChatGPT automation is not proof of native or unattended execution.
