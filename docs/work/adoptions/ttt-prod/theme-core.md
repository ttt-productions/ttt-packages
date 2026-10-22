# Adopt @ttt-productions/theme-core 0.12.15

**What:** App-specific sections are removed from `components.css`: rule cards, agreement list, dedication, DMCA info, landing page, future plans, attributions.
**Severity:** low
**Came from:** the ttt-packages shared-standards run (Phase 1)

- **Package and version:** `@ttt-productions/theme-core` 0.12.15.
- **Release:** `./scripts/release-multiple.sh dev-standards module-core input-format-core edge-protocol-core realtime-core firebase-helpers ui-core repo-guards theme-core query-core monitoring-core media-schemas chat-schemas report-core audit-core notification-core ttt-core mobile-core media-viewer file-input auth-core upload-core upload-ui media-processing-core chat-core chat-react rate-limit-core moderation-core patch`.
- **What changed:** App-specific sections are removed from `components.css`: rule cards, agreement list, dedication, DMCA info, landing page, future plans, attributions. Comments across the package follow the tightened shared comment rules (RULE-STD-COMMENT-001, RULE-STD-COMMENT-012); rule citations in code use the new `RULE-STD-*` IDs.
- **What the app must change:** Before installing, copy the rule sets ttt-prod uses from its installed theme-core `components.css` into its own stylesheet in `layer(base)` (selectors and pages in the run's `adoption-notes.md`, theme-core).
- **Done when:** The lockfiles name `@ttt-productions/theme-core` 0.12.15 or later, the work above is done, and the gate is green.
