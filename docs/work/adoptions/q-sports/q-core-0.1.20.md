# Adopt @ttt-productions/q-core 0.1.20

**What:** `isActiveAccount` takes a stored status of any value; q-core's tests carry no blanket cast.
**Severity:** low
**Came from:** the ttt-prod shared-standards Phase 3 repair session (third package release)

- **Package and version:** `@ttt-productions/q-core` 0.1.20.
- **Release:** `./scripts/release-multiple.sh audit-core chat-react chat-schemas dev-standards firebase-helpers media-processing-core media-viewer moderation-core monitoring-core notification-core q-core rate-limit-core repo-guards report-core ttt-core ui-core upload-ui patch`.
- **What changed:** `isActiveAccount` takes `{ userStatus: unknown }`, since it judges what a stored profile holds; a status outside the declared set still fails closed. q-core's tests were retyped with no `as never` / `as unknown as` (typed builders, per-sport generic checks, a correction to a real non-correctable stat). The one cast left, in `picture-upload-variables.ts`, is a reviewed exception in ttt-packages' boundary suite.
- **What the app must change:** Install. Nothing else.
- **Done when:** The lockfiles name 0.1.20 or later.
