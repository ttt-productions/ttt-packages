# Adopt @ttt-productions/ui-core 0.11.37

**What:** `Progress` reports its value to assistive technology.
**Severity:** low
**Came from:** the ttt-prod shared-standards Phase 3 repair session (third package release)

- **Package and version:** `@ttt-productions/ui-core` 0.11.37.
- **Release:** `./scripts/release-multiple.sh audit-core chat-react chat-schemas dev-standards firebase-helpers media-processing-core media-viewer moderation-core monitoring-core notification-core q-core rate-limit-core repo-guards report-core ttt-core ui-core upload-ui patch`.
- **What changed:** `Progress` passes `value`, clamped to 0–`max`, to Radix, so `aria-valuenow` and the loading / complete `data-state` are set, and draws the bar from the same clamped value. With no value it is indeterminate.
- **What the app must change:** Install. Nothing changes for a caller; a test that asserted a `Progress` with no `aria-valuenow` now sees one.
- **Done when:** The lockfiles name 0.11.37 or later.
