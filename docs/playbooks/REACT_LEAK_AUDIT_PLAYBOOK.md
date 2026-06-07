<!-- ttt-packages production-grade audit playbook. Methodology only; do not record findings here. -->
# React Leak Audit Playbook

## Purpose

Verify that every package in `packages/` follows the main-entry server-safety rule defined in `docs/design/react-safety.md`. A "leak" is any path by which React, JSX, or browser-only APIs end up in the module graph of a package's main entry. Leaks crash the Cloud Functions emulator on cold start and inflate consumer bundles unnecessarily.

This playbook does NOT re-audit the rule itself — that's the design doc's job. It checks for drift between the rule and the code.

## When to run

- Before publishing any package whose `src/index.ts` was modified.
- After any refactor that moves files between `src/` and `src/react/`.
- After adding a new file under `src/` — it's easy to forget the rule and add a barrel re-export to main.
- When the Cloud Functions emulator starts crashing with `react/jsx-runtime` resolution errors.
- After changing package-to-package imports inside `packages/*`.
- Quarterly as drift control.

## Audit steps

### 1. Per-package main-entry classification

For each directory under `packages/`:

    cat packages/<pkg>/src/index.ts

Walk every `export ... from "./..."` line and every `import` line. Classify the file:

- **COMPLIANT** — exports only server-safe primitives. No React imports, no JSX, no re-exports from `./react`, `./ui`, `./components`, or `./hooks`.
- **VIOLATOR** — at least one export pulls React into the graph.
- **N/A** — package has no React code anywhere; rule is trivially satisfied.

Type-only re-exports (`export type { ... }`) are COMPLIANT because types are erased at compile time and leave no runtime trace.

If a source file exports both types and runtime constants, do not use `export *` or `export type *` from the server-safe barrel. `export *` may pull in future runtime exports; `export type *` drops current runtime constants. Use explicit named re-exports, as in `chat-core` for `GROUP_GAP_SEC`.

### 2. Transitive check

If main re-exports from another barrel file (`export * from "./things"`), read that file and every file it re-exports. Any React import, JSX, browser-only API, or re-export from `./react`, `./ui`, `./components`, or `./hooks` means main is not server-safe.

Also scan for server-safe-looking utility barrels that import a React component "just for a type". Use `import type` and move shared types into a neutral file instead.

### 3. `package.json` exports field

For each package with React surface, read `packages/<pkg>/package.json` and confirm the `exports` field exposes React through a separate subpath:

    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "./react": {
        "types": "./dist/react/index.d.ts",
        "default": "./dist/react/index.js"
      }
    }

Packages with Cloud Functions/Admin SDK code add `./server`. Packages with CSS may add a `./styles` or `.css` subpath. Existing conventions are preserved only after a full consumer sweep; never flip an established public subpath without updating every consumer.

### 4. Internal package-to-package imports

Run:

    grep -RIn "@ttt-productions/" packages --include='*.ts' --include='*.tsx'

For every import between shared packages:

- React components, hooks, providers, and contexts must come from `@ttt-productions/<pkg>/react`.
- Server/Admin helpers must come from `@ttt-productions/<pkg>/server`.
- Types, constants, schemas, and pure helpers stay on the main barrel.
- Do not import React surface from another package's main barrel even inside `ttt-packages`; the same rule applies to internal consumers and app consumers.

### 5. Built-output spot check

After a package is refactored and rebuilt:

    grep -RIn "from \"react\"\|from 'react'\|from \"react-dom\"" packages/<pkg>/dist/index.js

Should return zero hits. The compiled main entry must have zero React imports.

If the package has React surface, also confirm:

    ls packages/<pkg>/dist/react/

Exists and contains `index.js` and `index.d.ts`.

For packages with `/server`, also confirm the server dist exists and does not import browser/React code.

### 6. React barrel directive check

When adding a new `src/react/index.ts` barrel, prefer starting the barrel with `"use client";` and keep that directive off the server-safe main barrel. If adopting this as a hard requirement for an existing package, sweep the current package first; several older React files rely on leaf-module boundaries rather than a barrel-level directive.

### 7. Ambient shim cleanup in consumers

Search consuming repos for package-specific ambient shims created to work around NodeNext export resolution:

    find ../ttt-prod/functions/src -name "*.d.ts" -maxdepth 2 -print
    grep -RIn "declare module '@ttt-productions/\|declare module \"@ttt-productions/" ../ttt-prod/functions/src --include='*.d.ts'

These shims are workarounds, not architecture. After a package's main-barrel surface changes, re-evaluate the corresponding shim for deletion by removing it locally and running the consuming app's typecheck plus Functions build. Restore it only if either fails.

### Peer-dependency install safety (client peers must be optional)

The runtime checks above catch React *loaded* through a main entry. They do not catch React *installed* through a required peer dependency. A package whose `.` / `./server` surface is runtime-clean can still force React into a server-only install if it declares `react`, `react-dom`, `@tanstack/react-query`, a React-ecosystem library, the client `firebase` SDK, or `@ttt-productions/ui-core` / `@ttt-productions/query-core` as a *required* peer.

For each package that declares any client-only peer, confirm it is marked optional:

    node -e "const p=require('./packages/<pkg>/package.json'); const meta=p.peerDependenciesMeta||{}; for (const k of Object.keys(p.peerDependencies||{})) console.log(k, meta[k]?.optional ? 'optional' : 'REQUIRED')"

Every client-only peer must print `optional`. The only packages that may keep required client peers are those with no server-safe surface at all — currently none in `packages/`. Internal infrastructure peers that are themselves server-safe (e.g. `@ttt-productions/firebase-helpers`) may remain required.

Optional peers are not auto-installed. So any client peer marked `optional` that a package imports in its own source must also be listed in that package's `devDependencies` — otherwise the package's own build, typecheck, and tests fail, because it can no longer rely on npm's required-peer auto-install (or a consumer) to provide it. `query-core` is the reference: `@tanstack/react-query` is both an optional peer and a devDependency.

### 8. Audit output

Generate `docs/audits/REACT_LEAK_AUDIT.md` only while there are active findings. Include:

- A summary table with one row per package: package name, version, has React code, main is server-safe, `/react` subpath exists, action needed.
- Per-violator detail sections with the offending re-export lines from `src/index.ts` and the current `package.json` exports field.
- A refactor-order recommendation in dependency order.

After the audit table is acted on and every violator is resolved, delete `docs/audits/REACT_LEAK_AUDIT.md`. The playbook is permanent; audit outputs are transient.

## Common failure patterns

- New shadcn component added to `ui-core` and someone re-exports it from `src/index.ts` instead of `src/react/index.ts`.
- Package has `src/react/` and `src/index.ts` correctly set up, but a stale line `export * from "./react/index.js"` is left in main.
- New hook in `chat-core` or `notification-core` exported from main alongside constants. Constants are fine; hooks are not.
- A barrel file under `src/utils/` quietly imports from `src/components/` for a "shared" type, which drags React into the utils graph and through to main.
- New package created from a copy of another package and the `package.json` exports field doesn't get updated to include `./react`.
- Re-export of an entire React surface via `export * from "./react/index.js"` from main "for convenience".
- Mixed-export file re-exported with `export *`, accidentally exposing future runtime values from the server-safe main entry.
- Internal package-to-package import pulls a component from another package's main barrel instead of `/react`.
- Consuming app keeps a stale ambient `.d.ts` shim after the package export shape is fixed.

## Output / Pass-fail criteria

**PASS** when every package in `packages/` is COMPLIANT or N/A, every package with React surface exposes it through `/react`, package-to-package imports use the correct subpath, built `dist/index.js` files contain zero React imports, stale ambient shims have been re-evaluated in consuming repos, and `docs/audits/REACT_LEAK_AUDIT.md` is absent because there is nothing left to track.

**FAIL** if any package's main entry imports React directly, re-exports a React-touching file, re-exports from `./react`, lacks the public subpath needed by consumers, or lets another package import React surface from its main barrel. Each FAIL is logged in `docs/audits/REACT_LEAK_AUDIT.md` with the specific offending lines, and the package's next release is blocked until resolved.

## Automation fallback

If an `npm run audit:react-leaks` script exists, run it first and treat failures as blockers. The manual greps above remain the fallback and the review checklist for cases the script does not cover yet.
