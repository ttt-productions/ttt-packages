# @ttt-productions/query-core

Generic TanStack Query package.

## Owns

- Query client/default option factories with neutral names
- Query provider and helper hooks
- Firestore/query integration utilities
- Generic search hook/types
- Domain-event invalidator mechanism (`createDomainEventInvalidator`, `exact`, `prefix`, `predicate`, `applyInvalidations`)

## Subpaths

- `.` â€” server-safe root: cache helpers, Firestore types and `docWithId`, infinite-data helpers, search types, and the domain-event invalidator mechanism. No React or react-query in the runtime graph.
- `./keys` â€” pure, dependency-free query-key builders (`keys`, `createKeyScope`, `QueryKey`). Safe for any runtime, including backend code that produces invalidation key arrays.
- `./react` â€” React/TanStack runtime: provider, Firestore hooks, search hook, and the `createQueryClient` factory.
- `./types` â€” Firestore option/type surface.

Client peers (`react`, `react-dom`, `@tanstack/react-query`) are optional; they are needed only when importing `./react`.

## Boundary

Concrete TTT query keys, search presets, and domain-event invalidation entries live in TTT app code or `ttt-core`. This package should not export TTT- or Q-Sports-branded presets.

## Search hook boundary for Realm / Work discovery

`query-core` may provide generic Firestore prefix-search utilities, but it must not hard-code TTT collection names or presets. TTT-specific search configs for `publicUsers`, `publicWorkProjects`, and `workRealms` live in `ttt-core` or the consuming app.

If the generic search hook is extended for the Realm/discovery launch slice, keep the API generic: equality filters plus lowercase prefix search over a caller-provided collection and field. Do not add TTT-specific branches such as `useWorkRealmSearch` inside `query-core`.
