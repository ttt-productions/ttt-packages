# Adopt @ttt-productions/dev-standards 0.0.12

**What:** `createAppVitestConfig`'s `app-browser` project loads its tests.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/dev-standards` 0.0.12.
- **Release:** `./scripts/release-multiple.sh dev-standards patch`.
- **What changed:** the `app-browser` project (`browserEntryTests`, 0.0.11) failed to load every file it named with `ex.test is not a function`: its `server.deps.inline: true` was concatenated onto the root's inline list. It now inlines through a pattern that matches every dependency, so the merged list holds only patterns.
- **What the app must change:** Install `@ttt-productions/dev-standards@latest` wherever it is declared. Nothing else; an app that names no `browserEntryTests` sees no change.
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.12 or later and the gate is green.
