# T03/TQ43 rendered-image audit

The production ledger reported four homepage SVGs at two viewport widths as
broken. All four source files exist and are valid XML. The audit inspected all
`document.images`, including images in cards excluded by the homepage's existing
six-card selection. Those CSS-hidden lazy images are not expected to load.
The homepage's own card test already checked only visible cards.

Change the audit, not the articles, assets, card selection or design:

- Exclude only CSS display/visibility-hidden images. Do not unhide a card or
  change its loading mode to make a test pass. Count that scope exclusion in
  evidence; it is not proof that every hidden asset decodes correctly.
- Scroll rendered same-origin lazy images into view and wait for native decode,
  within a per-image/page budget. Restore the original scroll position.
- Keep real 404 and invalid-image decode failures as failures. Treat unfinished
  loads, 401/403/429 and unknown transport state as unverified, not successful or
  permanently broken. Do not force external image requests.
- Navigation/inspection failures contribute inconclusive TQ43 evidence, so an
  unchecked page cannot make old findings appear recovered. Keep the old error
  fingerprint shape for genuine image failures.

Ten pure classification cases pass. A new Chromium fixture checks 390/1440px:
CSS-hidden images stay hidden, a below-fold lazy image starts incomplete and
loads when scrolled, 404 and invalid SVG are broken, 403 and a stalled request
are unverified, and scroll is restored. These tests use synthetic SVGs and a
loopback HTTP server in the existing public-repository CI; they do not view the
private SLOT test file or require the blocked file-URL browser action.
The fixture and live checks must be verified separately from source tests.

The existing consent/browser workflow and security test entrypoints run the
checks; no job, schedule, permission, resource or billing setting is added.
Public-site live evidence remains a partial rendered-image inspection, not
complete responsive-image, screenshot-diff, iPhone or whole-62-item approval.
T03 stays incomplete; TQ43 recovery is recorded only after the production audit.
