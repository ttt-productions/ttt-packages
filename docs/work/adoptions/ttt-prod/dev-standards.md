# Adopt @ttt-productions/dev-standards 0.0.2

**What:** New package: the shared rulebook, AI docs, workflows, playbooks, `docs/work/` rules, and config bases.
**Severity:** low
**Came from:** the ttt-packages shared-standards run (Phase 1)

- **Package and version:** `@ttt-productions/dev-standards` 0.0.2.
- **Release:** `./scripts/release-multiple.sh dev-standards module-core input-format-core edge-protocol-core realtime-core firebase-helpers ui-core repo-guards theme-core query-core monitoring-core media-schemas chat-schemas report-core audit-core notification-core ttt-core mobile-core media-viewer file-input auth-core upload-core upload-ui media-processing-core chat-core chat-react rate-limit-core moderation-core patch`.
- **What changed:** New package: the shared rulebook, AI docs, workflows, playbooks, `docs/work/` rules, and config bases. Comments across the package follow the tightened shared comment rules (RULE-STD-COMMENT-001, RULE-STD-COMMENT-012); rule citations in code use the new `RULE-STD-*` IDs.
- **What the app must change:** Phase 3 of the shared-standards run adopts it: values block + `@import` in `CLAUDE.md`, the converter run, the app rulebook rewrite (3C), playbook additions (3D), and the config bases (3E). See `ttt-packages/docs/work/projects/shared-standards/PLAN.md` § Phase 3.
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.2 or later, the work above is done, and the gate is green.
