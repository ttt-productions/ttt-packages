# Adopt @ttt-productions/mobile-core 0.9.6

**What:** `useInputNavigation` takes an optional `cssPrefix` (default `app`) and now honors a custom prefix.
**Severity:** low
**Came from:** the ttt-packages shared-standards run (Phase 1)

- **Package and version:** `@ttt-productions/mobile-core` 0.9.6.
- **Release:** `./scripts/release-multiple.sh dev-standards module-core input-format-core edge-protocol-core realtime-core firebase-helpers ui-core repo-guards theme-core query-core monitoring-core media-schemas chat-schemas report-core audit-core notification-core ttt-core mobile-core media-viewer file-input auth-core upload-core upload-ui media-processing-core chat-core chat-react rate-limit-core moderation-core patch`.
- **What changed:** `useInputNavigation` takes an optional `cssPrefix` (default `app`) and now honors a custom prefix. Comments across the package follow the tightened shared comment rules (RULE-STD-COMMENT-001, RULE-STD-COMMENT-012); rule citations in code use the new `RULE-STD-*` IDs.
- **What the app must change:** Install `@ttt-productions/mobile-core@latest` wherever it is declared; nothing else changes.
- **Done when:** The lockfiles name `@ttt-productions/mobile-core` 0.9.6 or later and the gate is green.
