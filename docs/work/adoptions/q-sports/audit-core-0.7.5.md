# Adopt @ttt-productions/audit-core 0.7.5

**What:** The audit event type is a type alias, and the writer stores it with no casts.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/audit-core` 0.7.5.
- **Release:** `./scripts/release-multiple.sh audit-core auth-core chat-react chat-schemas consent-core dev-standards edge-protocol-core file-input firebase-helpers media-processing-core media-schemas media-viewer mobile-core moderation-core monitoring-core notification-core query-core rate-limit-core realtime-core repo-guards report-core ttt-core ui-core upload-core upload-ui patch`.
- **What changed:** `AuditEvent` is a `type` alias instead of an `interface` (same fields), so it is assignable to Firestore's document data; `writeAuditEvent` writes it with no cast.
- **What the app must change:** Install only, unless app code declaration-merges into `AuditEvent` (an alias cannot be merged).
- **Done when:** The lockfiles name `@ttt-productions/audit-core` 0.7.5 or later, and the gate is green.
