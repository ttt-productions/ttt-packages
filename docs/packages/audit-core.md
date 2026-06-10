# @ttt-productions/audit-core

Generic audit-event writer package.

## Owns

- Generic audit document shape helpers
- Audit writer factory parameterized over event type, actor, target, and metadata generics
- Server entry for Admin SDK-backed writes

## Contract shape

Entry points: `.` (types only), `./server` (factory + writer).

- `.` — `AuditEvent<TEventType, TActor, TTarget, TMetadata>`: generic audit record (id, timestamp, result success/failure, optional IP/user-agent/region/correlationId).
- `./server` — `createAuditWriter(config: AuditWriterConfig) → { writeAuditEvent }`; `writeAuditEvent(args) → Promise<string>` (returns event id). `AuditWriterConfig` = `{ db, collectionPath, defaultSchemaVersion?, idGenerator? }`. Write args accept an optional Firestore `batch` or `transaction` so the event commits atomically with the action — the property the CLAUDE.md audit rules depend on.

## Boundary

TTT owns the audit event catalog and any app-specific actor/target unions. TTT wrappers bind those types when calling the generic writer.
