# Adopt @ttt-productions/ui-core 0.11.36

**What:** Link-variant buttons carry a stable hook class.
**Severity:** medium
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/ui-core` 0.11.36.
- **Release:** `./scripts/release-multiple.sh audit-core auth-core chat-react chat-schemas consent-core dev-standards edge-protocol-core file-input firebase-helpers media-processing-core media-schemas media-viewer mobile-core moderation-core monitoring-core notification-core query-core rate-limit-core realtime-core repo-guards report-core ttt-core ui-core upload-core upload-ui patch`.
- **What changed:**
  - `Button`'s `link` variant adds the class `ui-button-link`, the one stable name an app keys a rule for link-styled buttons on (never a match on `underline` or another utility).
  - Internal toast typing; no behaviour change.
- **What the app must change:** Install. Any app stylesheet rule that singles out link-styled buttons by matching a utility in the class list keys on `.ui-button-link` instead.
- **Done when:** The lockfiles name `@ttt-productions/ui-core` 0.11.36 or later, and the gate is green.
