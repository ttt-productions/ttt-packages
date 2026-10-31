# A shared package for signed agreements: typed name, drawn signature, and versioned acceptance

**What:** Move Q-Sports' drawn-signature mechanism into a generic ttt-packages package, so ttt-prod imports it instead of building a second copy.
**Severity:** medium
**Came from:** DJ, 2026-10-30, in the orchestration conversation (ttt-prod item `typed-name-and-signature-at-binding-moments.md`)
**Trigger:** Q-Sports' 2.0 migration passes its hosted dev E2E tests with the signature mechanism still in the app. Then this package is built, Q-Sports adopts it and passes the same hosted dev E2E tests again, and only then does ttt-prod import it.

## Why

Both products need a person to sign: Q-Sports for league waivers and hardware agreements, ttt-prod
for a guild-invite accept and a Work's first publish (each with a typed full name and a drawn
signature). One mechanism, one owner (RULE-STD-ENG-002, RULE-STD-ENG-003). The order above is DJ's:
the mechanism is proven in Q-Sports on hosted dev first, then moved, then re-proven, then reused.

## What moves (from Q-Sports, made generic)

Everything app-specific — the origin names, paths, wording, who signs what, which collections — is
supplied by the app through factories and configuration (RULE-STD-ARCH-201). This repository is
public, so nothing here names an app's security internals (RULE-STD-ARCH-209).

- **React:** the signature pad (canvas drawn to a PNG, clear, empty check), a typed full-name field,
  and a sign control that stays disabled until both are filled. A drawn signature counts as unsaved
  input for the leave guard (upload-ui).
- **Server:** promote a staged signature to its kept path, release it when the signing is refused
  after the copy, the copy-intent record and the maintenance reap of a stranded copy, and a
  server-side check that the signature file is the caller's own upload and that the name and
  signature are both present. The callable refuses an unsigned signing no matter what the client
  sent.
- **The signed record's shape:** who signed, the typed name, the wording and its version as the
  signer saw it, the kept signature file, and what was signed for (an app-supplied payload). The app
  writes its audit event (with the request's IP and user agent) in the same transaction.
- **Admin read:** a server helper that hands an admin a short-lived read of a kept signature file;
  clients never read one directly.

## New package or an existing one (open — DJ picks)

The recommendation from the orchestration conversation: **a new package**, because no existing
package owns this. ui-core is UI primitives only (the pad would fit, the server half would not);
upload-core / upload-ui own the upload runtime and the leave guard, not what a file means;
consent-core owns browser cookie/analytics consent; media-processing-core processes media, and a
signature is kept unprocessed. Splitting the pad into ui-core and the server half elsewhere would
split one mechanism across two packages (RULE-STD-ENG-004 prohibits it).

**What else could live in it.** Both products also record *versioned clickwrap acceptance* — a list
of agreement points ticked, the wording version sent, the server refusing anything but the current
version, and the version stored on the record. ttt-prod does this at artisan onboarding, publish
attestations, audition and commission agreements, Square agreements, and Realm founding; Q-Sports
records the waiver template version a signer saw. A typed name and a drawn signature are just a
stronger form of the same act. So the package could own **agreement acceptance as a whole**:

- the agreement checklist component and its "every box ticked" gate;
- the current-version check and the record helpers;
- the typed name and drawn signature as optional stronger steps on top.

**DJ leans toward `agreement-core`**, built around one configurable **agreement section** (DJ,
2026-10-30):

- **Configurable steps.** The app picks which steps a given agreement needs: checkboxes (the agreement
  points), a typed full name, a drawn signature, and later possibly a selfie (only an idea so far,
  not decided). One component and one server check, configured per use, instead of a separate
  agreement UI at every binding moment.
- **Inline or popup.** The section can render inline on the page or inside a popup. DJ prefers
  inline, to avoid popup problems (a phone keyboard over a dialog, a dialog closing on a drawn
  signature, focus and scroll trouble). Q-Sports signs in a popup today
  (`hardware-contract-dialog.tsx`, the waiver signing dialog); whether its signing moves inline when
  it adopts the package is DJ's call then.
- **The gate is the same in both.** The confirming control stays disabled until every configured
  step is complete, and the server re-checks every configured step, whatever the client sent.

Decide with DJ, after a look at how each product records acceptance today, whether the existing
checkbox agreements (ttt-prod's onboarding, publish, audition, commission, Square, and Realm ones)
move onto the section in the same work or later.

## Done when

- The package is built (main entry server-safe, React behind `./react`, Admin SDK behind `./server`,
  RULE-STD-ARCH-202), documented in `docs/packages/`, and green in `npm run test:quiet`.
- Q-Sports has adopted it and passed its hosted dev E2E tests again on it.
- ttt-prod has an adoption file to import it for its two signing moments.
