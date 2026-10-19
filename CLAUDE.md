# TTT Packages — Shared Monorepo

## Overview

Shared monorepo of reusable packages published under the `@ttt-productions/*` scope. Generic packages know nothing about any consuming app — no app identifiers, Firestore collection names, copy strings, moderation policies, or domain-event catalogs. An app's data lives in that app's application-data package or in the consuming app's wrapper (ARCH-201, ARCH-207).

## Mandatory reading — every package task

ttt-packages has its own engineering rules in `docs/engineering-rules/`. Before reviewing, planning, designing, editing, or running implementation commands here:

- Read `docs/development-preferences.md` — how an AI works with DJ. Nothing in it is repeated here.
- Read `docs/engineering-rules/README.md` and `docs/engineering-rules/core-rules.md`.
- Read the routed area files per that README. **`architecture.md`, `quality.md`, and `comments.md` apply to essentially every package task**; add `firestore.md`, `frontend.md`, or `media.md` when the change touches them.
- Read the package ownership/design docs below for where a concept belongs, then inspect the current code (code is the implementation truth, ENG-001).
- Any prompt that spawns an implementation, design, or review agent names that agent's mandatory reading as explicit paths (ENG-010).

An application-data package is governed by its own app's rulebook, not this one (ARCH-207).

## Engineering rules that bite most

One-line pointers; the rule file is authoritative:

- **ARCH-201** — generic packages stay application-agnostic (no app identifiers/paths/copy/policy, no application-data package import); supply app values via factory/adapter.
- **ARCH-202** — main entries stay server-safe (React behind `./react`, Admin SDK behind `./server`, browser upload behind `./browser`); client-only peers declared `optional`.
- **ARCH-203** — no compatibility barrels or laundering re-exports; delete dead transitional subpaths.
- **ARCH-206** — package Firestore access goes through `@ttt-productions/query-core`'s `useFirestore*` hooks (`firebase-helpers` + `query-core` are the only direct-Firestore layers; sanctioned exceptions carry an in-file block and are listed in `package-architecture.md`).
- **ARCH-208** — releases go through the batch release command, patch-only until v1.
- **QUALITY-201 / QUALITY-202** — code is the source of truth; docs explain durable ownership and avoid drift-prone exhaustive inventories.

## Package design docs (authoritative for ownership, tiers, entries, build/release order)

- `docs/packages/package-architecture.md` — the one-stop model: tiers, entry purity, imports inside a package, subpath conventions, dependency-direction rules, build/release order, internal caret pinning, and the boundary-guard tests.
- `docs/packages/*.md` — one short doc per package for what it owns, exposes, and guarantees.
- `docs/design/upload-path-invariant.md`, `docs/design/react-safety.md`, `docs/design/display-identity-invariant.md` — cross-cutting package invariants.

Orientation only (read the docs above before designing): generic Tier 0 foundations → Tier 1 → the application-data packages (outside the numbered tiers) → `upload-ui` → `chat-react`. Build and release both follow the one topological dependency order written in the root `package.json` build chain; `scripts/package-order.mjs` prints it for the release scripts.

## Verification

`npm run test:all` is the canonical, must-pass gate for any change here — run it green BEFORE handing off a publish list or pushing. It chains: `npm audit --omit=dev --audit-level=high` (the EXACT command the publish workflow runs — a high advisory in a shipped dependency fails a publish, so the gate must fail first) → lint → format (`prettier --check` over every package's code) → build (every package, topo order) → typecheck → `npx tsc -b --noEmit` → `vitest run`. **Build runs before the two type-check stages on purpose:** both resolve internal `@ttt-productions/*` imports through `node_modules → dist`, and the release preflight (and `npm run clean`) wipe `dist`, so a build-first order is what lets the gate survive a clean tree. The `tsc -b` step is the only one that type-checks `__tests__`.

**Quiet runner — `npm run test:quiet` (the pre-commit / pre-publish gate).** Runs the `test:all` stages and then, ONLY if all pass, a final `schema` stage that runs `schema:check` and **auto-regenerates** `docs/generated/firestore-schema.{md,mmd}` when stale. One line per stage; on failure it prints only the failing output. Exit 0 when everything passes (including when stale schema docs were regenerated — commit them before publishing); non-zero on any failure. Targeted: `npm run test:quiet:test`, or `node scripts/test-quiet.mjs --only <audit|lint|format|typecheck|tscb|build|test|schema>`. An audit red is a lockfile fix (`npm audit fix` stays inside declared ranges; a fix that needs a range change is a real dependency bump for the owning package), never a reason to lower the threshold. A transitive advisory that a shipped dependency's own range cannot reach is handled by a parent-scoped root `overrides` entry guarded by `test/boundary/firestore-grpc-override-guard.test.ts`, which fails the gate when the override becomes redundant.

**Linting.** Root `eslint.config.mjs` (flat config) lints `packages/**` only: `@eslint/js` + `typescript-eslint` recommended + `react-hooks` (rules-of-hooks / exhaustive-deps as **error**). `no-explicit-any` off, `^_` unused-ignore, empty `catch` allowed. Run with `npm run lint` (or `lint:fix`); it runs right after the audit stage in `test:all` / `test:quiet`. `eslint-config-prettier` runs last, so no ESLint rule formats. Lint policy (a justified, reasoned `eslint-disable-next-line` is permitted for the narrow intentional cases) is owned by **QUALITY-006**.

**Formatting.** Prettier formats every package code file (`.prettierrc.json`: 100 columns, single quotes, Prettier's defaults otherwise). `npm run format` writes it; `npm run format:check` is the gate's format stage, right after lint. The format rule is **QUALITY-006**.

## Release gate & tooling

The user-facing entrypoint for a selected package set is ALWAYS `./scripts/release-multiple.sh <folder> [<folder> ...] patch` with short folder names (patch until v1 — ARCH-208). Never hand the user `release-package.sh` directly; it is only the internal per-package engine invoked by the batch script. The batch runs `scripts/preflight.sh` once, and the preflight runs `npm run test:quiet` — so a release shows concise per-stage output. Root `package.json` is `"type": "module"`; the internal release engine's `node -p "require(...)"` usage still works under Node 24 — do not remove it to "fix" a release issue.

## First-time publish of a new package

Publishing runs through npm Trusted Publishing (`.github/workflows/publish.yml`), and npm attaches a
trusted publisher only to a package that already exists. So a package that has never been on npm
gets one manual first publish; it is setup, not a release, and every publish after it is the release
command above. With the new package built and `npm run test:quiet` green, hand DJ the steps in order:

1. From the ttt-packages root, DJ runs `npm publish --access public --workspace @ttt-productions/<folder>`
   (its own fenced `bash` block). It publishes the package's current `package.json` version. That
   manual tarball skips CI's `pin-internal-deps` step, so its internal `@ttt-productions/*` ranges are
   the source's `"*"`; step 3 replaces it as `@latest`, and nothing installs it in between.
2. On npmjs.com, DJ opens the new package → **Settings** → **Trusted Publisher**, and under
   **Select your publisher** clicks **GitHub Actions**. He fills in:
   - **Organization or user:** `ttt-productions`
   - **Repository:** `ttt-packages`
   - **Workflow filename:** `publish.yml`
   - **Environment name:** left blank
   - **Allowed actions:** allow direct publishing with `npm publish`. `publish.yml` publishes with
     `npm publish`, and a publisher allowed only `npm stage publish` (the always-on default) fails
     every release. **Allow npm dist-tag** stays off.

   Then he saves. npm does not check the setup when it is saved; a mistake shows only as a failed
   publish in step 3. The setup expires unless a publish through it succeeds within 2 days, so step 3
   follows right away.
3. DJ runs the normal release command, `./scripts/release-multiple.sh <folder> patch`, with the new
   package's folder (alongside any other package in the batch). That release is the version
   consumers install. If its `publish.yml` run fails at `npm publish`, the trusted-publisher fields in
   step 2 are the first thing to check.

The session waits for DJ to say step 3 is published, then follows the Release and adoption workflow
below.

## Version bump selection — patch only until v1

**Until the packages' v1, every release is a `patch` bump** (ARCH-208) — additive exports, fixes, AND breaking changes (a removed export, a changed signature) alike. Never hand off `minor` or `major`.

Why: all packages are 0.x, and published internal ranges are carets (`^0.11.0`), which on 0.x **lock the minor**. A `minor` bump escapes every dependent's caret range, so the consuming app's `npm install` ERESOLVE-fails (or nests duplicate copies) until every package that declares the bumped one is republished in lockstep. A `patch` flows through every caret untouched. A breaking change still requires confirming that no consumer relies on what it removes or alters before it ships as a patch.

At the v1 launch the packages take a major release; from then on conventional semver applies (breaking → major, additive → minor, fix → patch), and this section is rewritten for it.

## Release and adoption workflow — the packages half of the app's Normal Dev Flow

This section is the ttt-packages half of the app-in-scope's **Normal Dev Flow** (defined in that
app's `CLAUDE.md`: packages first → this gate → the release command → DJ publishes → the session
polls npm and installs → app work → the app's Normal Test Flow).

- Keep package-source changes and consuming-app adoption separate. Any `@ttt-productions/*` change
  happens here FIRST: finish the complete package batch, run focused checks while editing, then one
  final `npm run test:quiet`.
- After the gate is green, STOP and hand DJ ONLY the release command (`./scripts/release-multiple.sh …`,
  see Release gate above), in its own fenced `bash` block — no install commands.
- DJ runs the publish and says so. The session then starts a 20-minute clock and checks npm every 30
  seconds until every released package's new version is the `@latest` on npm. Then the session runs
  the installs itself in the consuming app (the app in scope): at the app root and in every consuming
  folder that declares the package, `@latest`, never a pinned version, every install line ending with
  `--prefer-online` so npm re-checks the registry instead of answering `@latest` from its cached
  metadata right after a publish. It confirms each lockfile names the new version and continues the
  app adoption with no further go. A version still missing from npm after 20 minutes = stop and tell
  DJ which package. Never adopt against unpublished sibling source, and never install anything but
  the published version.
- Do not reference a sibling local checkout from consuming-app implementation prompts.
- Run package builds/tests for every package touched.
- Regenerate lockfiles after package renames or dependency graph changes.
