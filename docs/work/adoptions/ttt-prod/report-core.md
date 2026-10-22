# Adopt @ttt-productions/report-core 0.16.21

**What:** `SubmitReportResult<TProtectedFork extends string = string>`; the package no longer names any case kind.
**Severity:** low
**Came from:** the ttt-packages shared-standards run (Phase 1)

- **Package and version:** `@ttt-productions/report-core` 0.16.21.
- **Release:** `./scripts/release-multiple.sh dev-standards module-core input-format-core edge-protocol-core realtime-core firebase-helpers ui-core repo-guards theme-core query-core monitoring-core media-schemas chat-schemas report-core audit-core notification-core ttt-core mobile-core media-viewer file-input auth-core upload-core upload-ui media-processing-core chat-core chat-react rate-limit-core moderation-core patch`.
- **What changed:** `SubmitReportResult<TProtectedFork extends string = string>`; the package no longer names any case kind. Builds unchanged. Comments across the package follow the tightened shared comment rules (RULE-STD-COMMENT-001, RULE-STD-COMMENT-012); rule citations in code use the new `RULE-STD-*` IDs.
- **What the app must change:** Pass its protected-case union where it types the submit result; the call sites are in the private notes in ttt-prod, `docs/work/projects/shared-standards-run/adoption-notes.md` (report-core).
- **Done when:** The lockfiles name `@ttt-productions/report-core` 0.16.21 or later, the work above is done, and the gate is green.
