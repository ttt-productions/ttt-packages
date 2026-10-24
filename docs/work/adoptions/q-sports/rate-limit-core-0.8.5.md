# Adopt @ttt-productions/rate-limit-core 0.8.5

**What:** A deliberate catch carries its reason.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/rate-limit-core` 0.8.5.
- **Release:** `./scripts/release-multiple.sh audit-core auth-core chat-react chat-schemas consent-core dev-standards edge-protocol-core file-input firebase-helpers media-processing-core media-schemas media-viewer mobile-core moderation-core monitoring-core notification-core query-core rate-limit-core realtime-core repo-guards report-core ttt-core ui-core upload-core upload-ui patch`.
- **What changed:** The `onDegraded` callback's catch carries its RULE-STD-ENG-009 exception comment; no behaviour change.
- **What the app must change:** Install only.
- **Done when:** The lockfiles name `@ttt-productions/rate-limit-core` 0.8.5 or later, and the gate is green.
