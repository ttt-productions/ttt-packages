# TTT Packages — Shared Monorepo

## Values

The placeholders the shared docs use (`packages/dev-standards/claude/CLAUDE.base.md` § Placeholders),
as this repo reads them. **none** means the repo has no such thing, and what needs it does not apply.

| Placeholder | Value |
|---|---|
| `<APP_NAME>` | none — ttt-packages is not an app; the Test Flow does not apply, and its gate is § Verification |
| `<APP_REPO>` | none |
| `<PACKAGES_REPO>` | this repo, `C:\DjDev\ttt-packages` |
| `<DEV_STANDARDS>` | `packages/dev-standards` (read from source) |
| `<APP_RULES>` | none — ttt-packages keeps no rulebook of its own; the shared rulebook is its rulebook |
| `<APP_DATA_PACKAGE>` | none — `ttt-core` and `q-core` live here but follow their own apps' rulebooks |
| `<ADOPTION_APP>` | none — this repo writes `docs/work/adoptions/<app>/`, it adopts nothing |
| `<INSTALL_FOLDERS>` | none |
| `<DESIGN_DOCS>` | `docs/packages/package-architecture.md`, the package's `docs/packages/<name>.md`, and the `docs/design/*.md` invariants it touches |
| `<TERMINOLOGY_DOC>` | none |
| `<DEV_E2E_LAUNCH>` | none |
| `<HOSTED_E2E_DOC>` | none |
| `<HOSTED_DEV_URL>` | none |
| `<APP_WORKFLOWS>` | none |
| `<REFERENCE_PRODUCT>` | none |
| `<GUARD_SUITE>` | `npx vitest run --project boundary` |

Every other rule and playbook placeholder is **none** here: those name an app's own modules.

@packages/dev-standards/claude/CLAUDE.base.md

## Overview

Shared monorepo of reusable packages published under the `@ttt-productions/*` scope. Generic
packages know nothing about any consuming app — no app identifiers, Firestore collection names, copy
strings, moderation policies, or domain-event catalogs. An app's data lives in that app's
application-data package or in the consuming app's wrapper (RULE-STD-ARCH-201, RULE-STD-ARCH-207).

The shared rulebook is ttt-packages' rulebook: every package task reads it as the base says, routing
**architecture**, **quality**, and **comments** on essentially every package task. An
application-data package (`ttt-core`, `q-core`) is governed as its own app's code — the shared
apps-scoped rules plus its app's rulebook (RULE-STD-ARCH-207). Everything in this repository is
public (RULE-STD-ARCH-209).

## Engineering rules that bite most

One-line pointers; the rule text is authoritative:

- **RULE-STD-ARCH-201** — generic packages stay application-agnostic (no app identifiers/paths/copy/policy, no application-data package import); supply app values via factory/adapter.
- **RULE-STD-ARCH-202** — main entries stay server-safe (React behind `./react`, Admin SDK behind `./server`, browser upload behind `./browser`); client-only peers declared `optional`.
- **RULE-STD-ARCH-203** — no compatibility barrels or laundering re-exports; delete dead transitional subpaths.
- **RULE-STD-ARCH-206** — package Firestore access goes through `@ttt-productions/query-core`'s `useFirestore*` hooks (`firebase-helpers` + `query-core` are the only direct-Firestore layers; sanctioned exceptions carry an in-file block and are listed in `package-architecture.md`).
- **RULE-STD-ARCH-208** — releases go through the batch release command, patch-only until v1.
- **RULE-STD-ARCH-209** — nothing in this repository names an app's security internals.
- **RULE-STD-QUALITY-201 / RULE-STD-QUALITY-202** — code is the source of truth; docs explain durable ownership and avoid drift-prone exhaustive inventories.

## Package design docs (authoritative for ownership, tiers, entries, build/release order)

- `docs/packages/package-architecture.md` — the one-stop model: tiers, entry purity, imports inside a package, subpath conventions, dependency-direction rules, build/release order, internal caret pinning, and the boundary-guard tests.
- `docs/packages/*.md` — one short doc per package for what it owns, exposes, and guarantees.
- `docs/design/upload-path-invariant.md`, `docs/design/react-safety.md`, `docs/design/display-identity-invariant.md` — cross-cutting package invariants.

Orientation only (read the docs above before designing): generic Tier 0 foundations → Tier 1 → the application-data packages (outside the numbered tiers) → `upload-ui` → `chat-react`. Build and release both follow the one topological dependency order written in the root `package.json` build chain; `scripts/package-order.mjs` prints it for the release scripts.

## Verification

`npm run test:all` is the canonical, must-pass gate for any change here — run it green BEFORE handing off a publish list or pushing. It chains: `npm audit --omit=dev --audit-level=high` (the EXACT command the publish workflow runs — a high advisory in a shipped dependency fails a publish, so the gate must fail first) → build (every package, topo order) → lint → format (`prettier --check` over every package's code) → typecheck → `npx tsc -b --noEmit` → `vitest run`. **Build runs before lint and the two type-check stages on purpose:** the type-aware lint rules and both type checks resolve internal `@ttt-productions/*` imports through `node_modules → dist`, and the release preflight (and `npm run clean`) wipe `dist`, so a build-first order is what lets the gate survive a clean tree. The `tsc -b` step is the only one that type-checks `__tests__`.

**Quiet runner — `npm run test:quiet` (the pre-commit / pre-publish gate).** Runs the `test:all` stages and then, ONLY if all pass, a final `schema` stage that runs `schema:check` and **auto-regenerates** `docs/generated/firestore-schema.{md,mmd}` when stale. One line per stage; on failure it prints only the failing output. Exit 0 when everything passes (including when stale schema docs were regenerated — commit them before publishing); non-zero on any failure. Targeted: `npm run test:quiet:test`, or `node scripts/test-quiet.mjs --only <audit|build|lint|format|typecheck|tscb|test|schema>`. An audit red is a lockfile fix (`npm audit fix` stays inside declared ranges; a fix that needs a range change is a real dependency bump for the owning package), never a reason to lower the threshold. A transitive advisory that a shipped dependency's own range cannot reach is handled by a parent-scoped root `overrides` entry guarded by repo-guards' `dependencyOverrides` guard (`test/boundary/dependency-overrides.test.ts`), which fails the gate when the override becomes redundant.

**Linting.** Root `eslint.config.mjs` (flat config) lints `packages`, `test`, `scripts` and the root config files: `@eslint/js` + `typescript-eslint` recommended (`no-explicit-any` on) + `react-hooks` (rules-of-hooks / exhaustive-deps as **error**), plus the type-aware `no-unsafe-*` rules on every `.ts` / `.tsx` file, read through `tsconfig.workspace.json` and repo-guards' `tsconfig.test.json`. `^_` unused-ignore, empty `catch` allowed. Run with `npm run lint` (or `lint:fix`); it runs right after the build stage in `test:all` / `test:quiet`, since the type-aware rules read the built `dist` of every internal import — a lint run on a tree with no `dist` reports every internal import as an unresolved type. `eslint-config-prettier` runs last, so no ESLint rule formats. Lint policy (a justified, reasoned `eslint-disable-next-line` is permitted for the narrow intentional cases) is owned by **RULE-STD-QUALITY-006**.

**Formatting.** Prettier formats every code file — every package's, plus `test/`, `scripts/`, and the root config files (the shared `packages/dev-standards/config/prettier.json`, which `.prettierrc.json` points at: 100 columns, single quotes, Prettier's defaults otherwise). `npm run format` writes it and `npm run format:check` checks it. `npm run test:quiet`'s format stage, right after lint, does both — Prettier writes every package file, then the check runs — so a gate run leaves the tree formatted; `test:all` and the release preflight (`test:quiet --format-check-only`) only check, so a release never publishes formatting nobody committed. The format rule is **RULE-STD-QUALITY-006**.

## Release gate & tooling

The user-facing entrypoint for a selected package set is ALWAYS `./scripts/release-multiple.sh <folder> [<folder> ...] patch` with short folder names (patch until v1 — RULE-STD-ARCH-208). Never hand the user `release-package.sh` directly; it is only the internal per-package engine invoked by the batch script. The batch runs `scripts/preflight.sh` once, and the preflight runs `npm run test:quiet` — so a release shows concise per-stage output. Root `package.json` is `"type": "module"`; the internal release engine's `node -p "require(...)"` usage still works under Node 24 — do not remove it to "fix" a release issue.

A package that has never been on npm gets one manual first publish before its first release: the
shared base's § First-time publish of a new package.

## Version bump selection — patch only until v1

**Until the packages' v1, every release is a `patch` bump** (RULE-STD-ARCH-208) — additive exports, fixes, AND breaking changes (a removed export, a changed signature) alike. Never hand off `minor` or `major`.

Why: all packages are 0.x, and published internal ranges are carets (`^0.11.0`), which on 0.x **lock the minor**. A `minor` bump escapes every dependent's caret range, so the consuming app's `npm install` ERESOLVE-fails (or nests duplicate copies) until every package that declares the bumped one is republished in lockstep. A `patch` flows through every caret untouched. A breaking change still requires confirming that no consumer relies on what it removes or alters before it ships as a patch.

At the v1 launch the packages take a major release; from then on conventional semver applies (breaking → major, additive → minor, fix → patch), and this section is rewritten for it.

## Package work in the Normal Dev Flow

ttt-packages carries steps 1–4 of the app-in-scope's Normal Dev Flow (the shared base): the package
work, its adoption files, this repo's gate, and the release command. ttt-packages adds:

- Keep package-source changes and consuming-app adoption separate. Any `@ttt-productions/*` change
  happens here FIRST: finish the complete package batch, run focused checks while editing, then one
  final `npm run test:quiet`.
- Do not reference a sibling local checkout from consuming-app implementation prompts.
- Run package builds/tests for every package touched.
- Regenerate lockfiles after package renames or dependency graph changes.
