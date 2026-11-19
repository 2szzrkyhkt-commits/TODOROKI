# T03: homepage keyboard smoke coverage (2026-11-19 JST)

The canonical 45-item checklist remains **22 complete / 23 incomplete**. No task is checked off by this change.

## Verified live, before code changes

On `https://todoroki-gold.com/`, the cloud Chrome UI verified:

1. First Tab focuses 「本文へ移動」.
2. Enter navigates to `#main-content`; next Tab reaches the first news article.
3. Ten further Tabs reach the ticker control (the count reflects the live article list, not a permanent requirement).
4. Space changes its label from 「テロップを一時停止」 to 「テロップを再生」.
5. Enter restores 「テロップを一時停止」.

No article/external link was activated, no consent preference was saved, and no account or production setting was changed.

## Change

`keyboard-probe.mjs` checks this path with actual keyboard events on an isolated fresh page, with an 80-Tab bound. `browser.mjs` records TQ44 evidence separately by browser and viewport. Failed navigation is inconclusive, not a pass. The scope is explicitly partial; other pages and assistive technology are not covered.

Local syntax checks passed; six probe regression fixtures and 76 Python quality tests passed. Browser execution of the new script remains dependent on CI. Direct local Chromium is unavailable (`socket() failed: Operation not permitted`, including the approved escalation attempt); integrated cloud browser was usable for the manual path above.

## Remaining / restart conditions

T03 needs the full original 62-point reconciliation, untested routes/interactions and physical iPhone evidence. This smoke check does not satisfy those conditions.

The previous scheduled quality failure has a later successful run: https://github.com/2szzrkyhkt-commits/TODOROKI/actions/runs/44320111524 (2026-11-18 23:03 JST). `quality-history/history/44320111524-1.json` matches its schedule event, run ID and attempt and source commit `7d763138fe32a756c9dafcd8166562cd4655ab9b`. This is not proof of uninterrupted hourly coverage or completion of T45's independent cross-project watchdog.

Existing Automation definitions, Cron expressions, AdSense configuration, access permissions, T44 and completed-task checks are unchanged.
