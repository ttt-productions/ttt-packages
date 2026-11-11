# Keep the hosted E2E tool's tests out of ttt-prod's deploy

**What:** ttt-prod's release workflow stops running the tests of the hosted E2E tool; they run only in the local gate.
**Severity:** medium
**Trigger:** ttt-prod's adoption of the shared hosted-dev E2E package. Q-Sports' shared hosted-dev
E2E code moves into ttt-packages once DJ has verified Q-Sports' hosted paths green
(`docs/work/do-later/testing-and-guards/shared-e2e-primitives-package.md`); ttt-prod then adopts
that package, and this item goes with that adoption.

- **Package and version:** the shared hosted-dev E2E package, at the version that first ships it.
- **Release:** the release that first publishes the shared hosted-dev E2E package.
- **Why:** the hosted E2E tool is not part of the product. It runs only on a developer machine,
  against hosted dev. Its tests prove the tool, never the app, so a release gains nothing from them
  and can be blocked by them: a tool test that opens a browser fails on the deploy machine, which
  installs none. ttt-packages' own `publish.yml` runs no tests, so the package's tests run only on a
  developer machine too.
- **ttt-prod today:** `.github/workflows/deploy.yml`, step "Unit + component tests", runs
  `npm test`, which runs every frontend test, the 36 test files in `src/__tests__/hosted-harness/`
  among them. They pass there only because none opens a browser.
- **What the app must change**, as Q-Sports has it:
  - `vitest.config.ts` exports its options (`APP_VITEST_OPTIONS`), and a new
    `vitest.config.deploy.ts` builds the same config with the hosted E2E tool's test folders added
    to `exclude` (in ttt-prod, `src/__tests__/hosted-harness/`, plus any of the tool's tests still in
    the app after the move).
  - `package.json` gains `"test:deploy": "vitest run --config vitest.config.deploy.ts"`, and the
    deploy step runs `npm run test:deploy` instead of `npm test`.
  - `scripts/ci-parity.mjs` maps `'. :: npm run test:deploy'` to the `vitest (frontend)` stage in
    place of `'. :: npm test'`, and `scripts/__tests__/ci-parity.test.mjs` injects its fixture steps
    after the new run line.
  - `CLAUDE.md`'s command list names `test:deploy`.
  - Local `npm test` and the gate's vitest stage are unchanged: they still run every test.
- **Done when:** `npx vitest list --filesOnly --config vitest.config.deploy.ts` lists no file of
  the hosted E2E tool, `npx vitest list --filesOnly` still lists them, the ci-parity test passes,
  and a release runs green with the deploy step on `npm run test:deploy`.
