# React Leak Audit Playbook

## Purpose

Verify that every package in `<PACKAGES_REPO>/packages` follows the main-entry server-safety rule
(RULE-STD-ARCH-202; the model is `<PACKAGES_REPO>/docs/design/react-safety.md`). A "leak" is any path
by which React, JSX, or browser-only APIs end up in the module graph of a package's main entry, or a
client-only peer ends up installed into a server-only tree. Leaks crash the Cloud Functions emulator on
cold start and inflate consumer bundles. The playbook does not re-audit the rule itself; it checks for
drift between the rule and the code. Methodology only; the per-step contract, boundary, and verdict are
[README.md](README.md)'s.

**Boundary notes.** The local `<PACKAGES_REPO>` checkout, read-only; every command runs from its root.
`<GUARD_SUITE>` there is the boundary suite. A consuming app audits its own side (its server-only
install, step 10 of `dependency-audit-playbook.md`; its import entries, `codebase-hygiene-playbook.md`
step 17).

## When to run

Before publishing any package whose main entry changed; after moving files between a package's main
and its `react` folder; after adding a file under a package's `src`; when the Functions emulator starts
crashing on a `react/jsx-runtime` resolution; after changing package-to-package imports; quarterly as
drift control.

## Audit Steps

### 1. Per-package main-entry classification
**Rules:** RULE-STD-ARCH-202, RULE-STD-ARCH-203. **Scope:** each package's main entry
(`packages/<pkg>/src/index.ts`).
```bash
<GUARD_SUITE> -t "every entry not declared runtime-specific reaches no Node, React, or browser runtime|every universal and Node entry loads under plain Node"
```
**Expected:** the guards are green. Then read each main entry's `export … from` and `import` lines and
classify the package: **COMPLIANT** — exports only server-safe primitives, with no React import, no
JSX, and no re-export from a `react`, `ui`, `components`, or `hooks` folder; **VIOLATOR** — at least one
export pulls React into the graph; **N/A** — no React code anywhere. Type-only re-exports are compliant.
A source file exporting both types and runtime constants is re-exported by explicit names, never
`export *` (which can pull in future runtime exports) or `export type *` (which drops today's runtime
constants).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 2. Transitive check
**Rules:** RULE-STD-ARCH-202, RULE-STD-ARCH-203. **Scope:** every barrel a main entry re-exports.
**Method (read each re-exported file).**
**Expected:** no file the main entry reaches imports React, contains JSX, uses a browser-only API, or
re-exports from a React folder. A server-safe-looking utility barrel that imports a React component
"just for a type" is the finding — use `import type`, and move shared types to a neutral file.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 3. The `exports` field
**Rules:** RULE-STD-ARCH-202. **Scope:** every package manifest with React surface.
```bash
<GUARD_SUITE> -t "every definition a package exports is exported by exactly one entry"
```
**Expected:** every package with React surface exposes it through a separate `./react` subpath (types
and default both pointing into `dist/react`); a package with Admin SDK code adds `./server`; a package
with CSS a style subpath. An established public subpath is never flipped without updating every
consumer in the same change.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 4. Internal package-to-package imports
**Rules:** RULE-STD-ARCH-202. **Scope:** every import between packages.
```bash
<GUARD_SUITE> -t "every package definition is imported from the entry that owns it"
rg -n "@ttt-productions/" packages -g '*.ts' -g '*.tsx' -g '!**/dist/**'
```
**Expected:** the guard is green, and every import between packages takes React components, hooks,
providers, and contexts from `/react`, server and Admin helpers from `/server`, and types, constants,
schemas, and pure helpers from the main entry. The rule binds packages importing each other exactly as
it binds apps.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 5. Built-output spot check
**Rules:** RULE-STD-ARCH-202. **Scope:** a refactored package's built `dist`.
```bash
npm run build
rg -n "from [\"']react[\"']|from [\"']react-dom[\"']" packages/<pkg>/dist/index.js
```
**Expected:** zero hits — the compiled main entry has no React import. A package with React surface
also has `dist/react/` with its `index.js` and `index.d.ts`; a package with `/server` has a server dist
that imports no browser or React code.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 6. React barrel directive
**Rules:** RULE-STD-ARCH-202. **Scope:** each package's React barrel. **Method (read).**
**Expected:** a new React barrel starts with `"use client";` and the directive stays off the
server-safe main barrel. Adopting the directive as a hard requirement for an existing package sweeps
that package first; some older React files rely on leaf-module boundaries instead.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 7. Main-barrel changes that consumers' shims depend on
**Rules:** RULE-STD-ARCH-202, RULE-STD-ARCH-205. **Scope:** a release that changes a main barrel.
**Method (read the change note).**
**Expected:** a consuming app may carry an ambient `.d.ts` shim for a package export it could not
resolve, and audits those shims in its own playbooks. This package side: when a main barrel's surface
changes, its adoption note says so, so each consuming app re-evaluates any shim it holds for that
package.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 8. Audit output
**Rules:** RULE-STD-QUALITY-202 (the run report is transient; the playbook holds no findings). **Scope:**
the run's report.
**Expected:** the run report is one `react-leak-audit-playbook-run.md` in the app in scope's <!-- no-check -->
`docs/work/raw-findings/playbook-runs/` ([README.md](README.md)), with a summary table per package
(name, version, has React code, main is server-safe, `/react` subpath exists, action needed),
per-violator detail with the offending re-export lines and the current `exports` field, and a refactor
order in dependency order. Once every violator is resolved, the report is deleted.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 9. Client-only peers are optional
**Rules:** RULE-STD-ARCH-202. **Scope:** every package manifest that declares a client-only peer.
The checks above catch React *loaded* through a main entry; they do not catch React *installed*
through a required peer. A package whose main and server surfaces are runtime-clean still forces React
into a server-only install if it declares `react`, `react-dom`, `@tanstack/react-query`, a React
library, the client `firebase` SDK, or a React-only `@ttt-productions/*` package as a *required* peer.
```bash
node -e "const p=require('./packages/<pkg>/package.json'); const meta=p.peerDependenciesMeta||{}; for (const k of Object.keys(p.peerDependencies||{})) console.log(k, meta[k]?.optional ? 'optional' : 'REQUIRED')"
```
**Expected:** every client-only peer prints `optional`; only a package with no server-safe surface at
all may keep a required client peer. A server-safe internal peer may stay required. An optional peer is
never auto-installed, so any optional client peer a package imports in its own source is also one of
its dev dependencies — otherwise its own build, typecheck, and tests fail (query-core's
`@tanstack/react-query` is the reference: an optional peer and a dev dependency).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

## Common failure patterns

- A new UI component added to a package and re-exported from its main entry instead of its React
  barrel.
- A stale `export * from "./react/index.js"` left in a main entry "for convenience".
- A hook exported from a main entry alongside constants — constants are fine; hooks are not.
- A utility barrel that quietly imports from a components folder for a "shared" type, dragging React
  into main.
- A new package copied from another with the `exports` field never updated to add `./react`.
- A mixed-export file re-exported with `export *`, exposing future runtime values from main.
- A package-to-package import taking a component from another package's main entry instead of
  `/react`.
- A consuming app keeping a stale ambient shim after the export shape is fixed.

## Pass / Fail

Per [README.md](README.md) § Verdict. **PASS** — every package is COMPLIANT or N/A, React surface ships
through `/react`, package-to-package imports use the right subpath, built main entries contain zero
React imports, every client-only peer is optional, and every main-barrel change is noted for
consumers. **FAIL** — a main entry imports or re-exports React, a needed public subpath is missing, or
another package imports React surface from a main entry; the package's next release is blocked until it
is resolved.
