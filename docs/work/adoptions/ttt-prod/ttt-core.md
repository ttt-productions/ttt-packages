# Adopt @ttt-productions/ttt-core 0.79.109

**What:** BREAKING: app security values leave the public package (the schemas stay).
**Severity:** high
**Came from:** the ttt-packages shared-standards run (Phase 1)

- **Package and version:** `@ttt-productions/ttt-core` 0.79.109.
- **Release:** `./scripts/release-multiple.sh dev-standards module-core input-format-core edge-protocol-core realtime-core firebase-helpers ui-core repo-guards theme-core query-core monitoring-core media-schemas chat-schemas report-core audit-core notification-core ttt-core mobile-core media-viewer file-input auth-core upload-core upload-ui media-processing-core chat-core chat-react rate-limit-core moderation-core patch`.
- **What changed:** BREAKING: app security values leave the public package (the schemas stay). New: compound-id builders and parsers (path builders take parts), and a shared reaper timeout constant. Comments across the package follow the tightened shared comment rules (RULE-STD-COMMENT-001, RULE-STD-COMMENT-012); rule citations in code use the new `RULE-STD-*` IDs.
- **What the app must change:** BEFORE installing, copy each removed value from the installed ttt-core into its private home, then switch every importer and adopt the compound-id builders; every value, importer, and destination is in the private notes in ttt-prod, `docs/work/projects/shared-standards-run/adoption-notes.md` (ttt-core) and `phase3-notes.md` (3F).
- **Done when:** The lockfiles name `@ttt-productions/ttt-core` 0.79.109 or later, the work above is done, and the gate is green.
