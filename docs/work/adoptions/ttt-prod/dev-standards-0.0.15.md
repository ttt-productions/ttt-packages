# Adopt @ttt-productions/dev-standards 0.0.15

**What:** The Playwright base always fails a `.only` and asks every browser for reduced motion; the Vitest bases fail a `.only`.
**Severity:** low
**Came from:** the ttt-packages test-base session (Q-Sports scope, ttt-parity)

- **Package and version:** `@ttt-productions/dev-standards` 0.0.15.
- **Release:** `./scripts/release-multiple.sh dev-standards q-core patch`.
- **What changed:**
  - `node/playwright` `createPlaywrightConfig` sets `forbidOnly: true` on every run (it was CI only) and `use.reducedMotion: 'reduce'`, so every project's browser runs under the app's reduced-motion kill switch (RULE-STD-FRONTEND-204).
  - `node/vitest` `createAppVitestConfig`, `createFunctionsVitestConfig` and `createRulesVitestConfig` set `allowOnly: false`.
  - No rule text changed.
- **What the app must change:** the install. `playwright.config.ts` already builds on `createPlaywrightConfig`, so it sets neither setting of its own; a Vitest config that sets `allowOnly` of its own drops it. A spec that depended on motion running in the browser is fixed to pass under reduced motion, never by overriding `reducedMotion` (`playwright.hosted-dev.config.ts`, which is not on the base, keeps its own `forbidOnly: true`).
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.15 or later, and the e2e suite is green under reduced motion with zero retry-passes.
