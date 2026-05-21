# @ttt-productions/audit-core

Generic audit-event writer package.

## Owns

- Generic audit document shape helpers
- Audit writer factory parameterized over event type, actor, target, and metadata generics
- Server entry for Admin SDK-backed writes

## Boundary

TTT owns the audit event catalog and any app-specific actor/target unions. TTT wrappers bind those types when calling the generic writer.
