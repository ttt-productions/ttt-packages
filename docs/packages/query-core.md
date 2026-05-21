# @ttt-productions/query-core

Generic TanStack Query package.

## Owns

- Query client/default option factories with neutral names
- Query provider and helper hooks
- Firestore/query integration utilities
- Generic search hook/types
- Domain-event invalidator mechanism (`createDomainEventInvalidator`, `exact`, `prefix`, `predicate`, `applyInvalidations`)

## Boundary

Concrete TTT query keys, search presets, and domain-event invalidation entries live in TTT app code or `ttt-core`. This package should not export TTT- or Q-Sports-branded presets.
