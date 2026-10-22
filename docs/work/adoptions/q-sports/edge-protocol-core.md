# Adopt @ttt-productions/edge-protocol-core 0.1.14

**What:** BREAKING: every edge→origin provenance and internal-auth header name is now configuration.
**Severity:** high
**Came from:** the ttt-packages shared-standards run (Phase 1)

- **Package and version:** `@ttt-productions/edge-protocol-core` 0.1.14.
- **Release:** `./scripts/release-multiple.sh dev-standards module-core input-format-core edge-protocol-core realtime-core firebase-helpers ui-core repo-guards theme-core query-core monitoring-core media-schemas chat-schemas report-core audit-core notification-core ttt-core mobile-core media-viewer file-input auth-core upload-core upload-ui media-processing-core chat-core chat-react rate-limit-core moderation-core patch`.
- **What changed:** BREAKING: every edge→origin provenance and internal-auth header name is now configuration. `defineProvenanceHeaders({...})` and `defineInternalAuthHeaders({...})` return the names; `precheckInternalHeaders(headers, names, opts)` takes them. The old header constants are removed (no re-export). Comments across the package follow the tightened shared comment rules (RULE-STD-COMMENT-001, RULE-STD-COMMENT-012); rule citations in code use the new `RULE-STD-*` IDs.
- **What the app must change:** If Q-Sports imports any removed header constant, define its own names through the two factories.
- **Done when:** The lockfiles name `@ttt-productions/edge-protocol-core` 0.1.14 or later, the work above is done, and the gate is green.
