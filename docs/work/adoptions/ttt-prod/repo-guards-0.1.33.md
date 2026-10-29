# Adopt @ttt-productions/repo-guards 0.1.33

**What:** The retired-segment guard stops reporting module paths, route strings and source-file paths; the truncation guard reads its owners from any loaded stylesheet.
**Severity:** low
**Came from:** the ttt-packages shared-package session (Q-Sports scope, ttt-parity)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.33.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards theme-core patch`.
- **What changed:**
  - `firestoreRetiredSegments` takes a required `routePrefixes` fact (the app's page roots, the same list `appRouteOwner` takes; `[]` when there is none). It never reports a module specifier (import, re-export, `import()`, `require()`, test-runner mock, type import), a string or template that opens with one of those page roots as a whole segment, or a string or template that names a source file (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts`).
  - `sharedTruncation` takes a required `entryStylesheet` fact. A clamp owner is held when any stylesheet the entry loads declares it as a clamp — an installed package's included — so the shared class may live in theme-core.
- **What the app must change:** Install `@ttt-productions/repo-guards@latest`. In the guard config, give `firestoreRetiredSegments` `routePrefixes` (reuse the list `appRouteOwner` holds) and `sharedTruncation` `entryStylesheet` (the config's `ENTRY_STYLESHEET`). A `firestoreRetiredSegments` reviewed match that only excused a module path, route, or source-file path now reports as stale and is deleted. The truncation class move itself is the theme-core 0.12.16 adoption.
- **Done when:** The lockfiles name `@ttt-productions/repo-guards` 0.1.33 or later, and the guard suite is green.
