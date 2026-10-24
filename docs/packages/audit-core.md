# @ttt-productions/audit-core

Generic audit-event writer package.

## Owns

- Generic audit document shape helpers
- Audit writer factory parameterized over event type, actor, target, and metadata generics
- Server entry for Firestore-backed writes, over the `firebase-helpers/server` contract

## Contract shape

Entry points: `.` (types only), `./server` (factory + writer).

- `.` — `AuditEvent<TEventType, TActor, TTarget, TMetadata>`: generic audit record (id, timestamp, result success/failure, optional IP/user-agent/region/correlationId).
- `./server` — `createAuditWriter(config: AuditWriterConfig) → { writeAuditEvent }`; `writeAuditEvent(args) → Promise<string>` (returns event id). `AuditWriterConfig` = `{ db, collectionPath, defaultSchemaVersion?, idGenerator? }`. `db` is the `firebase-helpers/server` `ServerFirestore` contract (an app's Admin SDK `db` is one), and write args accept an optional `ServerWriteBatch` or `ServerTransaction`, so a consuming app can make an audit event commit atomically with the action it records.

## Boundary

Each consuming app owns its audit event catalog and any app-specific actor/target unions; the app's wrapper binds those types when calling the generic writer.
