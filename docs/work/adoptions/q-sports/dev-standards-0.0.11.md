# Adopt @ttt-productions/dev-standards 0.0.11

**What:** `createAppVitestConfig` can run a client entry's tests on the browser build; the crosswalk names `firestoreClientWrites`.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/dev-standards` 0.0.11.
- **Release:** `./scripts/release-multiple.sh query-core firebase-helpers repo-guards dev-standards patch`.
- **What changed:**
  - `createAppVitestConfig({ browserEntryTests })` (optional) runs the named test globs in a third project, `app-browser`: jsdom, the `browser` resolve condition, and every dependency put through Vite. Those files leave the `app` project. Without the option the config is unchanged.
  - `playbooks/crosswalk.md` lists repo-guards' `firestoreClientWrites` against RULE-STD-FRONTEND-104 and RULE-STD-FRONTEND-107.
- **What the app must change:** Install `@ttt-productions/dev-standards@latest` wherever it is declared. A test of a client entry that stubs a package's browser-only exports because the test loaded the server build (`@sentry/nextjs`'s transports and integrations) can name itself in `browserEntryTests` and run on the real client build.
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.11 or later and the gate is green.
