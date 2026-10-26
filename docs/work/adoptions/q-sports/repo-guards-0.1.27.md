# Adopt @ttt-productions/repo-guards 0.1.27

**What:** `partialMocks` reads a module mock named through `import('…')`, and a factory that returns through a listed pass-through helper keeps the real exports.
**Severity:** medium
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.27.
- **Release:** `./scripts/release-multiple.sh repo-guards patch`.
- **What changed:**
  - "a mock of a listed package root keeps the root's real exports" finds every `vi.mock` / `vi.doMock` of a listed root by either name form, `vi.mock('<root>', …)` or `vi.mock(import('<root>'), …)`. With every mock in the `import('…')` form, 0.1.26 saw none, failed each mock-free root as a stale entry, and checked nothing.
  - A factory keeps the real module when it spreads its own first parameter under any name (`async (io) => ({ ...(await io()), … })`), when every return goes through a listed pass-through helper handed that parameter (`passThroughModule(importOriginal, overrides)`), or when it loads the root's shared fake and that fake spreads the real module or calls a listed pass-through helper. A stub helper (`stubModule`) returns only the stubs, so a mock of a listed root through it fails.
  - `generic.partialMocks` takes a new required fact, `passThroughHelpers`: each an owner (a repo file, or a package entry such as `@ttt-productions/dev-standards/testing`) and the helpers it exports that return the real module with the overrides applied. Declare `[]` when there is none.
- **What the app must change:**
  - Add `passThroughHelpers: [{ owner: '@ttt-productions/dev-standards/testing', names: ['passThroughModule'] }]` to `generic.partialMocks` in the guard config.
  - Fix every mock of a listed root the guard now reports: a stub of a listed root becomes `passThroughModule(importOriginal, overrides)`.
- **Done when:** The guard config declares `passThroughHelpers`, the lockfiles name `@ttt-productions/repo-guards` 0.1.27 or later, and the `partialMocks` guard is green with no stale entry.
