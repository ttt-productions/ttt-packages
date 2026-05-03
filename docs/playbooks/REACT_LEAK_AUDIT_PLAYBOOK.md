<!-- ttt-packages production-grade audit playbook. Methodology only; do not record findings here. -->
# React Leak Audit Playbook

## Purpose

Verify that every package in `packages/` follows the main-entry server-safety rule defined in `docs/design/react-safety.md`. A "leak" is any path by which React, JSX, or browser-only APIs end up in the module graph of a package's main entry. Leaks crash the Cloud Functions emulator on cold start and inflate consumer bundles unnecessarily.

This playbook does NOT re-audit the rule itself — that's the design doc's job. It checks for drift between the rule and the code.

## When to run

- Before publishing any package whose `src/index.ts` was modified.
- After any refactor that moves files between `src/` and `src/react/`.
- After adding a new file under `src/` — Sonnet often forgets the rule and adds a barrel re-export to main.
- When the Cloud Functions emulator starts crashing with `react/jsx-runtime` resolution errors (almost always a leak; this playbook diagnoses which package).
- Quarterly as drift control.

## Audit steps

### 1. Per-package main-entry classification

For each directory under `packages/`:

    cat packages/<pkg>/src/index.ts

Walk every `export ... from "./..."` line and every `import` line. Classify the file:

- **COMPLIANT** — exports only server-safe primitives. No React imports, no JSX, no re-exports from `./react`, `./ui`, `./components`, or `./hooks`.
- **VIOLATOR** — at least one export pulls React into the graph.
- **N/A** — package has no React code anywhere; rule is trivially satisfied.

Type-only re-exports (`export type { ... } from "./react/foo.js"`) are COMPLIANT — types are erased at compile time and leave no runtime trace.

### 2. Transitive check (one level)

If main re-exports from a barrel file (`export * from "./things"`), read `src/things/index.ts` and check whether IT imports React. Don't recurse deeper than one level — if the barrel re-exports more barrels, flag for deeper inspection rather than walking the tree manually.

### 3. `package.json` exports field

For each VIOLATOR, read `packages/<pkg>/package.json` and capture the `exports` field. The post-refactor shape must match `auth-core`:

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

Packages with admin-SDK code add a third entry (`./server` or, for `firebase-helpers`, `./admin`).

### 4. Built-output spot check

After a violator is refactored and rebuilt:

    grep -RIn "from \"react\"\|from 'react'\|from \"react-dom\"" packages/<pkg>/dist/index.js

Should return zero hits. The compiled main entry must have zero React imports.

If the package has React surface, also confirm:

    ls packages/<pkg>/dist/react/

Exists and contains `index.js` and `index.d.ts`.

### 5. Audit output

Generate `docs/audits/REACT_LEAK_AUDIT.md` (overwriting any previous run). Include:

- A summary table with one row per package: package name, version, has React code, main is server-safe, `/react` subpath exists, action needed.
- Per-violator detail sections with the offending re-export lines from `src/index.ts` and the current `package.json` exports field.
- A refactor-order recommendation in dependency order (lowest-level packages first, packages that depend on others last).

After the audit table is acted on and every violator is resolved, delete `docs/audits/REACT_LEAK_AUDIT.md`. The playbook is permanent; the audit output is transient.

## Common failure patterns

- New shadcn component added to `ui-core` and someone re-exports it from `src/index.ts` instead of `src/react/index.ts`.
- Package has `src/react/` and `src/index.ts` correctly set up, but a stale line `export * from "./react/index.js"` is left in main from a previous shape.
- New hook in `chat-core` or `notification-core` exported from main alongside the constants. Constants are fine; hooks are not.
- A barrel file under `src/utils/` quietly imports from `src/components/` for a "shared" type, which drags React into the utils graph and through to main.
- New package created from a copy of another package and the `package.json` exports field doesn't get updated to include `./react`.
- Re-export of an entire React surface via `export * from "./react/index.js"` from main "for convenience" — convenience is not a justification for breaking the rule.

## Output / Pass-fail criteria

**PASS** when every package in `packages/` is COMPLIANT or N/A. Every violator has been refactored to the auth-core shape. `dist/index.js` for every package contains zero React imports. The audit output file in `docs/audits/` has been deleted because there's nothing left to track.

**FAIL** if any package's main entry imports React directly, re-exports a React-touching file, or re-exports from `./react`. Each FAIL is logged in `docs/audits/REACT_LEAK_AUDIT.md` with the specific offending lines, and the package's next release is blocked until resolved.

## Automating this audit

After the initial sweep is complete, add an `npm run audit:react-leaks` script at the repo root that runs step 4 (built-output grep) for every package and exits non-zero on any hit. Wire into the GitHub Actions workflow so a PR that introduces a leak fails CI. The playbook step then becomes "run the script" rather than "do the manual grep" — but the manual grep stays in this doc as a fallback for ad-hoc audits.
