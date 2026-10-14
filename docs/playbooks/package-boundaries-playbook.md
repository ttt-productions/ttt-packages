# Package boundaries playbook

## Purpose

Audit the generic `@ttt-productions/*` packages against the package rules they own: no
application-data import (ARCH-201, ARCH-207), monitoring-agnostic sources and manifests
(QUALITY-102), and Firestore access through query-core (ARCH-206). Entry-point and client-peer safety
(ARCH-202) is `REACT_LEAK_AUDIT_PLAYBOOK.md`. Whether an app's own vocabulary has leaked into the
packages it installs is that app's audit — only the app knows its vocabulary.

## When to run

Before a release that touches a package's imports, dependencies, or Firestore access; during a full
package audit; and whenever a new generic package is added.

## Audit boundary

The local ttt-packages checkout, read-only. Run every command from the ttt-packages root in Git Bash.
Each step records `PASS`, `FAIL`, `NOT RUN`, or `BLOCKED`.

## Audit steps

### 1. No generic package imports an application-data package
**Rules:** ARCH-201, ARCH-207. **Scope:** `packages/*/src`, excluding the application-data packages.
```bash
rg -n "from ['\"]@ttt-productions/(ttt|q)-core" packages/*/src -g '*.ts' -g '*.tsx' \
  -g '!packages/ttt-core/**' -g '!packages/q-core/**'
rg -n "\"@ttt-productions/(ttt|q)-core\":" packages -g package.json \
  -g '!packages/ttt-core/**' -g '!packages/q-core/**'
```
**Expected:** both print nothing. A hit is a generic package depending on one app's data; the fix
moves the app value behind a factory, adapter, callback, or configuration object the app supplies.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 2. Generic packages stay monitoring-agnostic
**Rules:** QUALITY-102. **Scope:** `packages/*/src` and `packages/*/package.json`.
```bash
rg -n "@sentry/|firebase-functions/params" packages/*/src -g '*.ts' -g '*.tsx' \
  -g '!packages/monitoring-core/**' -g '!**/__tests__/**'
rg -n "\"@sentry/[a-z-]+\"" packages/*/package.json
```
**Expected:** the first prints nothing — `monitoring-core` is excluded because it IS the sanctioned
monitoring mechanism. The second prints only `packages/monitoring-core/package.json`, and there every
SDK is a `peerDependencies` entry marked `optional` in `peerDependenciesMeta` (a
`devDependencies` entry for its own tests is fine) — a hard dependency pins
every consuming app to one vendor. A package that must report failures exposes an `onError`-style
seam, an error result, or a thrown error the app's adapter handles.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 3. Package Firestore access goes through query-core
**Rules:** ARCH-206. **Scope:** `packages/*/src`. Sanctioned-exception register:
`docs/packages/package-architecture.md`.
```bash
# a. Every package source line naming firebase/firestore, minus the two layers that ARE
#    the abstraction (query-core, firebase-helpers) rather than consumers of it.
rg -n "from ['\"]firebase/firestore['\"]" packages/*/src -g '*.ts' -g '*.tsx' \
  | rg -v "query-core|firebase-helpers"
# b. Narrow (a) to RUNTIME operations — constraint builders (where/orderBy/limit) and
#    Firestore *types* are allowed by ARCH-206, so only (b) is the gate.
rg -n "from ['\"]firebase/firestore['\"]" packages/*/src -g '*.ts' -g '*.tsx' \
  | rg -v "query-core|firebase-helpers" \
  | rg "getDoc|getDocs|onSnapshot|setDoc|updateDoc|addDoc|deleteDoc|writeBatch|runTransaction|collection|doc\("
```
**Expected:** every line in (a) imports only constraint builders or types, except what (b) prints.
(b) prints only direct-Firestore paths that carry an in-file `SANCTIONED EXCEPTION` block AND are
listed under **Sanctioned exceptions** in `docs/packages/package-architecture.md` — today the one
listed there. Any other line in (b) is the finding: route it through a `useFirestore*` hook with
`@ttt-productions/query-core` declared an **optional peer**. A new exception needs both the in-file
block and the package-architecture.md entry in the same change. A hit that only widens (a) — a new
constraint-builder or type-only import — is not a violation.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

## Common failure patterns

- An app's collection name, origin id, or copy string added to a generic package "just for now".
- A monitoring SDK added as a hard dependency instead of an optional peer.
- A React package calling `onSnapshot` directly because a query-core hook felt indirect.

## Output / Pass-fail criteria

**PASS** — every step's Expected holds. **PASS WITH EXCEPTIONS** — only documented, justified
exceptions remain. **FAIL** — any unexpected hit: record evidence (path + line), the violated rule ID,
severity, and a recommended correction in the run report, and bring it to DJ. A `NOT RUN` or
`BLOCKED` step is never counted as PASS.
