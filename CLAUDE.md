# TTT Packages — Shared Monorepo

## Overview

Shared monorepo of reusable packages published under the `@ttt-productions/*` scope — **24 packages** after the architecture rework. Generic packages must not know about TTT-specific business identifiers, Firestore collection names, copy strings, moderation policies, or domain-event catalogs. TTT-specific data lives in `@ttt-productions/ttt-core` or in the consuming app wrapper.

## Mandatory reading — every package task

Engineering rules are ONE system for both repos and live in ttt-prod. Before reviewing, planning, designing, editing, or running implementation commands here:

- Read `C:\DjDev\ttt-master-app\docs\engineering-rules\README.md` and `docs\engineering-rules\core-rules.md` (the ten universal `ENG-*` rules).
- Read the routed area files per that README's routing table. **`architecture/packages-and-boundaries.md` and the `quality/` rules apply to essentially every package task**; add other areas the change touches (a media package routes to `media/`, a React data hook to `frontend/`, etc.).
- Read the package ownership/design docs below for where a concept belongs, then inspect the current code (code is the implementation truth, ENG-001).
- Any prompt that spawns an implementation, design, or review agent names that agent's mandatory reading as explicit paths (ENG-010).

There is no second copy of `core-rules.md` in this repo — ttt-prod owns the canonical rulebook.

## Engineering rules that bite most from the package side

One-line pointers; the rule file is authoritative:

- **ARCH-201** — generic packages stay application-agnostic (no `ttt-core` import, no TTT identifiers/paths/copy/policy); supply app values via factory/adapter.
- **ARCH-101** — `ttt-core` is the application-data package: it may depend on generic packages and owns TTT cross-boundary schemas/constants/paths; generic packages never depend on it.
- **ARCH-202** — main entries stay server-safe (React behind `./react`, Admin SDK behind `./server`, browser upload behind `./browser`); client-only peers declared `optional`.
- **ARCH-203** — no compatibility barrels or laundering re-exports; delete dead transitional subpaths.
- **ARCH-206** — package Firestore access goes through `@ttt-productions/query-core`'s `useFirestore*` hooks (`firebase-helpers` + `query-core` are the only direct-Firestore layers; sanctioned exceptions carry an in-file block and are listed in `package-architecture.md`).
- **QUALITY-201 / QUALITY-202** — code is the source of truth; docs explain durable ownership and avoid drift-prone exhaustive inventories.

## Package design docs (authoritative for ownership, tiers, entries, build/release order)

- `docs/packages/package-architecture.md` — the one-stop model: tiers, root purity, subpath conventions, dependency-direction rules, build/release order, internal caret pinning, and the boundary-guard tests.
- `docs/packages/*.md` — one short doc per package for what it owns, exposes, and guarantees.
- `docs/design/upload-path-invariant.md`, `docs/design/react-safety.md`, `docs/design/display-identity-invariant.md` — cross-cutting package invariants.

Orientation only (read the docs above before designing): generic Tier 0 foundations → Tier 1 → `ttt-core` (application data, outside the numbered tiers) → `upload-ui` → `chat-react`. Build and release both follow the topological dependency order encoded in `scripts/release-multiple.sh`, `scripts/release-all.sh`, and the root `package.json` build chain.

## Verification

`npm run test:all` is the canonical, must-pass gate for any change here — run it green BEFORE handing off a publish list or pushing. It chains: lint → build (all 24, topo order) → typecheck → `npx tsc -b --noEmit` → `vitest run`. **Build runs before the two type-check stages on purpose:** both resolve internal `@ttt-productions/*` imports through `node_modules → dist`, and the release preflight (and `npm run clean`) wipe `dist`, so a build-first order is what lets the gate survive a clean tree. The `tsc -b` step is the only one that type-checks `__tests__`.

**Quiet runner — `npm run test:quiet` (the pre-commit / pre-publish gate).** Runs the `test:all` stages and then, ONLY if all pass, a final `schema` stage that runs `schema:check` and **auto-regenerates** `docs/generated/firestore-schema.{md,mmd}` when stale. One line per stage; on failure it prints only the failing output. Exit 0 when everything passes (including when stale schema docs were regenerated — commit them before publishing); non-zero on any failure. Targeted: `npm run test:quiet:test`, or `node scripts/test-quiet.mjs --only <lint|typecheck|tscb|build|test|schema>`.

**Linting.** Root `eslint.config.mjs` (flat config, ESLint 9) lints `packages/**` only: `@eslint/js` + `typescript-eslint` recommended + `react-hooks` (rules-of-hooks / exhaustive-deps as **error**). Mirrors ttt-prod's philosophy — `no-explicit-any` off, `^_` unused-ignore, empty `catch` allowed. Run with `npm run lint` (or `lint:fix`); it is the first stage of `test:all` / `test:quiet`. Lint policy (including that a justified, reasoned `eslint-disable-next-line` is permitted here for the narrow intentional cases, unlike ttt-prod's zero-suppression) is owned by **QUALITY-006**.

## Release gate & tooling

The user-facing entrypoint for a selected package set is ALWAYS `./scripts/release-multiple.sh <folder> [<folder> ...] <patch|minor|major>` with short folder names. Never hand the user `release-package.sh` directly; it is only the internal per-package engine invoked by the batch script. The batch runs `scripts/preflight.sh` once, and the preflight runs `npm run test:quiet` — so a release shows concise per-stage output. Root `package.json` is `"type": "module"`; the internal release engine's `node -p "require(...)"` usage still works under Node 22 — do not remove it to "fix" a release issue.

## Version bump selection (get this right — a wrong bump breaks the consuming install)

All packages are 0.x, and published internal peer ranges are carets (`^0.11.0`), which on 0.x **lock the minor**. Therefore:

- **`patch` is the default for every non-breaking change** — additive exports, new schemas/constants/modules, fixes. Dependents' existing `^0.x.y` peer ranges accept it; nothing else needs republishing.
- **`minor` is ONLY for a deliberate breaking contract change.** On 0.x it escapes every dependent's caret peer range, so the consuming app's `npm install` ERESOLVE-fails until every package that **directly declares** the bumped package (grep `packages/*/package.json` for its name) is republished in the same release, deps-first. Never hand off a `minor` publish without that dependent list in the same command.
- "It adds new capability" is NOT a reason for `minor` — additive = `patch` here, always.

## Release and adoption workflow

- Keep package-source changes and consuming-app adoption separate.
- Do not reference a sibling local checkout from consuming-app implementation prompts.
- The user handles version bumps, publishing, and dependency adoption.
- Run package builds/tests for every package touched.
- Regenerate lockfiles after package renames or dependency graph changes.

## Important rules

- Do not commit or push to git.
- Do not create source compatibility shims unless explicitly asked.
- Prefer deleting dead subpaths and stale docs during this pre-launch window.
- New generic features should use the same factory/adapter pattern as `auth-core` and the upload/backend packages.
