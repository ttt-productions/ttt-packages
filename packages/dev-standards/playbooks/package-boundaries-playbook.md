# Package Boundaries Playbook

## Purpose

Audit the generic `@ttt-productions/*` packages against the package rules they own: no
application-data import (RULE-STD-ARCH-201, RULE-STD-ARCH-207), monitoring-agnostic sources and
manifests (RULE-STD-QUALITY-102), Firestore access through query-core (RULE-STD-ARCH-206), one
reader for repository checks, one callable factory set, imports by defining file
(RULE-STD-ARCH-203), one enforced format (RULE-STD-QUALITY-006), test loading and time budgets
(RULE-STD-QUALITY-009, RULE-STD-QUALITY-010), and no wildcard package import (RULE-STD-ARCH-202).
Entry-point and client-peer safety is `react-leak-audit-playbook.md`. Whether an app's own vocabulary
has leaked into the packages it installs is that app's audit (`codebase-hygiene-playbook.md` step
41) — only the app knows its vocabulary. Methodology only; the per-step contract, boundary, and
verdict are [README.md](README.md)'s.

**Boundary notes.** The local `<PACKAGES_REPO>` checkout, read-only; every command runs from its root.
`<GUARD_SUITE>` there is the boundary suite.

## When to run

Before a release that touches a package's imports, dependencies, or Firestore access; during a full
package audit; whenever a new generic package is added.

## Audit Steps

### 1. No generic package imports an application-data package
**Rules:** RULE-STD-ARCH-201, RULE-STD-ARCH-207. **Scope:** `packages/*/src` and every package
manifest, excluding the application-data packages.
```bash
rg -n "from ['\"]@ttt-productions/(ttt|q)-core" packages/*/src -g '*.ts' -g '*.tsx' \
  -g '!packages/ttt-core/**' -g '!packages/q-core/**'
rg -n "\"@ttt-productions/(ttt|q)-core\":" packages -g package.json \
  -g '!packages/ttt-core/**' -g '!packages/q-core/**'
<GUARD_SUITE> -t "no generic package depends on an application-data package"
```
**Expected:** both greps print nothing and the guard is green. A hit is a generic package depending on
one app's data; the fix moves the app value behind a factory, adapter, callback, or configuration
object the app supplies. A new application-data package joins both patterns in the same change.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 2. Generic packages stay monitoring-agnostic
**Rules:** RULE-STD-QUALITY-102. **Scope:** `packages/*/src` and `packages/*/package.json`.
```bash
rg -n "@sentry/|firebase-functions/params" packages/*/src -g '*.ts' -g '*.tsx' \
  -g '!packages/monitoring-core/**' -g '!**/__tests__/**'
rg -n "\"@sentry/[a-z-]+\"" packages/*/package.json
```
**Expected:** the first prints nothing — `monitoring-core` is excluded because it IS the sanctioned
monitoring mechanism. The second prints only `monitoring-core`'s manifest, where every SDK is a peer
dependency marked `optional` (a dev dependency for its own tests is fine) — a hard dependency pins every
consuming app to one vendor. A package that must report failures exposes an `onError`-style seam, an
error result, or a thrown error the app's adapter handles.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 3. Package Firestore access goes through query-core
**Rules:** RULE-STD-ARCH-206. **Scope:** `packages/*/src`. Sanctioned-exception register:
`<PACKAGES_REPO>/docs/packages/package-architecture.md`.
```bash
# a. Every package source line naming firebase/firestore, minus the two layers that ARE the abstraction.
rg -n "from ['\"]firebase/firestore['\"]" packages/*/src -g '*.ts' -g '*.tsx' \
  | rg -v "query-core|firebase-helpers"
# b. Narrow (a) to RUNTIME operations — constraint builders and types are allowed, so only (b) gates.
rg -n "from ['\"]firebase/firestore['\"]" packages/*/src -g '*.ts' -g '*.tsx' \
  | rg -v "query-core|firebase-helpers" \
  | rg "getDoc|getDocs|onSnapshot|setDoc|updateDoc|addDoc|deleteDoc|writeBatch|runTransaction|collection|doc\("
```
**Expected:** every line in (a) imports only constraint builders or types, except what (b) prints. (b)
prints only direct-Firestore paths that carry an in-file `SANCTIONED EXCEPTION` block AND are listed
under the register's sanctioned exceptions. Any other line in (b) is the finding: route it through a
`useFirestore*` hook with query-core declared an optional peer. A new exception needs both the in-file
block and the register entry in the same change.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 4. Repository checks read through the one guard reader
**Rules:** RULE-STD-ENG-002, RULE-STD-ARCH-201. **Scope:** `test/boundary` and `packages/*/src`.
`@ttt-productions/repo-guards` owns reading a
repository for checks: one walker, one scope policy, one comment stripper. The boundary suite reads
through it too.
```bash
rg -n "readdirSync|readdir\(|opendirSync" test/boundary packages/*/src -g '*.ts' -g '*.js' \
  | rg -v "packages/repo-guards/src"
rg -n -i "\bttt-prod\b|ttt-master|q-sports|ttt-core|q-core" packages/repo-guards/src
```
**Expected:** the first prints nothing outside the guard package (whose own guards name these calls
as the patterns they ban); a check that walks a tree itself is the finding — read it through
`createRepoReader`. The second prints nothing: the guard package names no app, and an app's paths,
names, and exceptions arrive as its facts.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 5. A callable is declared through the shared callable factories
**Rules:** RULE-STD-ENG-002, RULE-STD-ENG-003, RULE-STD-FRONTEND-105. **Scope:** `packages/*/src`.
`query-core/react`'s `createCallables` is the one factory set for a callable hook (action, reader,
invoker, resumable). It builds on query-core's session-aware mutation owner, `useSessionMutation`. The
SDK's callable primitives stay inside firebase-helpers, behind `callCallable`.
```bash
rg -n "^[^/*]*\bhttpsCallable(FromURL)?\(" packages/*/src -g '*.ts' -g '*.tsx' | rg -v "packages/firebase-helpers/"
rg -n "useMutation\(" packages/*/src -g '*.ts' -g '*.tsx' | rg -i "callable"
```
**Expected:** the first prints nothing. The second prints nothing: every callable hook is built by
`createCallables` on the session-aware owner. A package that builds its own callable mutation hook is
the finding; it takes a hook built by `createCallables` from the app instead.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 6. Imports inside a package name the defining file by its built extension
**Rules:** RULE-STD-ARCH-203. **Scope:** every package's code and tests. Inside a package, code and tests import the file that defines each name,
never an index (an entry-surface test excepted), and every relative import names its file with its
built extension.
```bash
npm run build
<GUARD_SUITE> -t "inside a package, code imports the file that defines each name by its built extension, and only an entry index re-exports"
```
**Expected:** the run passes. Each finding names the file, the specifier, and the specifier it must be
(`'../src/x'` → `'../src/x.js'`); the fix is that specifier, never an allowlist entry.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 7. Every package code file is in the one Prettier format
**Rules:** RULE-STD-QUALITY-006. **Scope:** every package code file. Prettier formats package source and tests from the shared format
config; `eslint-config-prettier` is the last entry of the lint config.
```bash
npm run format:check
rg -n "prettier-ignore" packages -g '*.ts' -g '*.tsx' -g '*.js' -g '*.mjs' -g '*.cjs'
rg -n "eslint-disable" packages -g '*.ts' -g '*.tsx' -g '*.js' -g '*.mjs' -g '!**/dist/**'
```
**Expected:** the format check passes. Every `prettier-ignore` carries its reason; one that does not is
the finding. Every `eslint-disable-next-line` names a narrow, intentional case and carries its reason
on the line (package scope of RULE-STD-QUALITY-006); a reasonless one, or one dodging a real fix, is
the finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 8. A test loads the code it tests when its file loads
**Rules:** RULE-STD-QUALITY-009. **Scope:** every test in the repository. The repo-guards
`testCaseModuleLoads` guard reads every test in the
repository: no test, hook, or helper resets the module registry or runs a dynamic `import()` of
package code inside a case.
```bash
npm run build
<GUARD_SUITE> -t "a test loads the code it tests when its file loads, never inside a test case"
rg -n "export function __reset" packages -g '*.ts' -g '!*.test.ts'
```
**Expected:** the run passes, and each reviewed entry is a test whose fresh module per case is itself
what it proves. Every line the `rg` prints is a test-only seam that says so and clears all of its
module's per-instance state; production code never calls one.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 9. No wildcard import of a package
**Rules:** RULE-STD-ARCH-202. **Scope:** every package, script, and boundary test. The repo-guards
`packageWildcardImports` guard reads every package,
script, and boundary test: none takes another package whole through `import * as`, `export * as`, or
`export * from`.
```bash
npm run build
<GUARD_SUITE> -t "no code takes a scoped package whole through a wildcard import"
```
**Expected:** the run passes. Each finding names the file and the wildcard; the fix imports each name
the code uses, never an allowlist entry.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 10. A test needing more time names a budget
**Rules:** RULE-STD-QUALITY-010. **Scope:** every test in the repository. The repo-guards
`testTimeouts` guard reads every test in the
repository: every test, suite, hook, config, or Testing Library limit names a budget imported from the
packages' timeout file (`<PACKAGES_REPO>/test/timeouts.ts`), never a number.
```bash
npm run build
<GUARD_SUITE> -t "a test sets a time limit only by naming a budget from a timeout file"
rg -n "SLOW_TEST_TIMEOUT_MS" packages test -g '*.ts' -g '*.tsx'
```
**Expected:** the run passes. Every case or hook the `rg` prints does real heavy work, such as an
ffmpeg encode; one that only waits out a real timer (a retry delay, a debounce) is a finding, and its
fix is the fake clock, never a budget.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

## Common failure patterns

- An app's collection name, origin id, or copy string added to a generic package "just for now".
- A monitoring SDK added as a hard dependency instead of an optional peer.
- A React package calling `onSnapshot` directly because a query-core hook felt indirect.

## Pass / Fail

Per [README.md](README.md) § Verdict.
