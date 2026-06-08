# TTT Packages — Shared Monorepo

## Overview

Shared monorepo of reusable packages published under the `@ttt-productions/*` scope.

After the package architecture rework, the monorepo has **22 packages**. Generic packages must not know about TTT-specific business identifiers, Firestore collection names, copy strings, moderation policies, or domain-event catalogs. TTT-specific data lives in `@ttt-productions/ttt-core` or in the consuming app wrapper.

Read `docs/packages/` first for package ownership. Read `docs/design/` for cross-cutting invariants such as server-safe entries, React boundaries, and upload path shape. For the one-stop model of tiers, root purity, subpath conventions, direction rules, build/release order, internal version pinning, and the boundary-guard tests, see `docs/packages/package-architecture.md`.

## Verification

`npm run test:all` is the canonical, must-pass gate for any change here — run it green BEFORE handing off a
publish list or pushing. It chains: lint → build (all 22, topo order) → typecheck → `npx tsc -b --noEmit` →
`vitest run`. **Build runs before the two type-check stages on purpose:** both `typecheck` (per-workspace
`tsc --noEmit`) and `tsc -b --noEmit` resolve internal `@ttt-productions/*` imports through `node_modules →
dist`, so `dist` must exist first — and the release preflight (and `npm run clean`) wipe `dist`, so a
build-first order is what lets the gate (and the publish) survive a clean tree. The `tsc -b` step is the only
one that type-checks `__tests__` (per-workspace `typecheck` and the release preflight both skip them), so
`test:all` catches latent test-file type errors nothing else does.

**Quiet runner — `npm run test:quiet` (the pre-commit / pre-publish gate).** Runs the `test:all` stages
(lint → build all 22 → typecheck → `tsc -b --noEmit` → `vitest run`) and then, ONLY if all of them pass, a
final `schema` stage that runs `schema:check` and **auto-regenerates** `docs/generated/firestore-schema.{md,mmd}`
when they are stale. One line per stage; on failure it prints only the failing output (failing tests for
Vitest, error tail for plain stages), never the full passing log. Stop-on-fail throughout — a test failure
short-circuits before the schema stage. Exit 0 when everything passes, including when the schema docs were
stale and got regenerated (commit them before publishing); non-zero on any failure (including if the schema
regeneration itself errors). This is effectively the release preflight minus its clean-room reinstall (which
`release-*.sh` still run at publish time). Targeted: `npm run test:quiet:test` (Vitest only), or
`node scripts/test-quiet.mjs --only <lint|typecheck|tscb|build|test|schema>` (comma-separated; `--help`).

**Linting.** Root `eslint.config.mjs` (flat config, ESLint 9) lints `packages/**` only: `@eslint/js` +
`typescript-eslint` recommended + `react-hooks` (rules-of-hooks / exhaustive-deps as **error**). Mirrors
ttt-prod's philosophy — `no-explicit-any` off, `^_` unused-ignore (plus `ignoreRestSiblings`), empty `catch`
allowed. Build helpers under `**/scripts/**` and generated `**/dist` are not linted. Run with `npm run lint`
(or `lint:fix`); it is the first stage of `test:all` / `test:quiet`. Intentional react-hooks dependency
omissions (e.g. the firestore subscription hooks that track stringified keys) carry a justified
`eslint-disable-next-line` with the reason — prefer that over weakening the rule.

**Release gate & tooling.** The release preflight (`scripts/preflight.sh`, run by `release-package.sh` /
`release-all.sh`) runs `npm run test:quiet` — not the verbose `test:all` + a separate `schema:check` — so a
release shows concise per-stage output instead of thousands of lines. Root `package.json` is `"type": "module"`
so Vitest loads its configs via Vite's **ESM** Node API (the CJS build is deprecated). `node -p "require(...)"`
in `release-package.sh` still works under Node 22, so the type change is safe for the release scripts — do not
remove it to "fix" a release issue.

## Core architecture rules

1. **Generic packages do not import `ttt-core`.** If a generic package needs app-specific values, it exposes a factory, adapter, callback, schema factory, or configuration object.
2. **`ttt-core` is the application-data package.** It may depend on generic packages and composes TTT-specific schemas, constants, enums, paths, and business rules.
3. **Main entries stay server-safe.** React exports live behind `./react`; Admin SDK exports live behind `./server`; browser-only upload runtime lives behind `./browser`.
4. **No new compatibility barrels for pre-launch package moves.** Prefer canonical imports from the package that owns the concept. Delete unused transitional subpaths once grep proves there are no consumers.
5. **Code is source of truth.** Docs should explain durable ownership and rules; avoid duplicating exhaustive implementation details that will drift.
6. **Firestore access goes through query-core.** React packages read/write Firestore via `@ttt-productions/query-core`'s `useFirestore*` hooks (one shared `FirestoreProvider` supplies `db`), not direct `firebase/firestore` operations. `firebase-helpers` and `query-core` are the only intentional direct-Firestore layers. Sanctioned exceptions are marked in-file with a `SANCTIONED EXCEPTION` block and listed in `docs/packages/package-architecture.md` (currently `upload-ui`'s in-flight-uploads-provider).

## Current package tiers

### Tier 0 — generic foundations

- `auth-core`
- `firebase-helpers`
- `chat-schemas`
- `media-schemas`
- `mobile-core`
- `monitoring-core`
- `query-core`
- `theme-core`
- `ui-core`
- `rate-limit-core`
- `audit-core`
- `moderation-core`

### Tier 1 — depend on Tier 0 only

- `file-input`
- `media-viewer`
- `media-processing-core`
- `notification-core`
- `report-core`
- `upload-core`
- `chat-core` (pure — depends only on `chat-schemas`)

> `file-input` also depends on `media-viewer` (it renders `MediaPreview` in `MediaInput`'s in-picker file preview) — the only intra-Tier-1 edge. Build/release order already builds `media-viewer` before `file-input`, so no tier renumbering is needed.

### Tier 2

- `upload-ui`

### Tier 3

- `chat-react` (chat React UI — depends on `chat-core` + the UI tier)

### Application Data

- `ttt-core`

`ttt-core` is intentionally outside the numbered generic tiers. It can consume generic packages; generic packages cannot consume it.

## Important ownership notes

- `media-schemas` owns generic media types, media helpers, neutral media-origin spec shape, and pending-media schema factories.
- `ttt-core` owns concrete `FileOrigin`, `TTT_MEDIA_SPECS`, TTT upload wire schemas, target-info schemas, TTT pending-media schemas, domain events, and TTT atoms.
- `chat-schemas` owns pure chat schemas and server-safe chat contract constants that need to be safe for both UI and backend/schema consumers.
- `chat-core` owns the pure chat contracts, the mention parser/serializer, grouping helpers, and the generic mention provider contract. It depends only on `chat-schemas` (no React, no Firebase).
- `chat-react` owns the chat React UI/runtime, hooks, upload adapter, the Firebase-client adapter config types, and the mention autocomplete UI. It depends on `chat-core` plus the UI tier.
- `upload-ui` owns guarded upload UX across explicit React subpaths: `useGuardedUpload` and the deferred form shell in `/react/upload`, local upload guard and guarded navigation helpers in `/react/guard`, and upload activity UI/provider in `/react/tray`.
- `upload-core` owns only the low-level resumable upload primitive and browser upload queue/runtime.
- `query-core` owns generic query clients/hooks plus the reusable domain-event invalidator mechanism; TTT invalidation entries stay in the app.
- `firebase-helpers/react` owns generic callable hook primitives; app wrappers own toast, monitoring, and copy.
- `rate-limit-core`, `audit-core`, and `moderation-core` own generic backend mechanisms. TTT wrappers own app-specific strings, paths, secrets, policies, and violation behavior. `ttt-core` consumes `audit-core` to specialize its generic `AuditEvent` with the TTT `AuditEventType` catalog and TTT actor/target shapes.

## Entry-point safety

Current entry shape:

- `auth-core`: `.`, `./client`, `./react`, `./server`
- `firebase-helpers`: `.`, `./server`, `./react`, `./client`, `./firestore-client`
- `chat-schemas`: `.`
- `media-schemas`: `.`
- `mobile-core`: `.`, `./react`
- `monitoring-core`: `.`, `./react`
- `query-core`: `.` (server-safe), `./keys` (pure key builders), `./react`, `./types`
- `theme-core`: `.`, `./react`, CSS subpaths
- `ui-core`: `.`, `./react`
- `file-input`: `.`, `./react`
- `media-viewer`: `.`, `./react`, `./styles`
- `media-processing-core`: `.`, `./server`
- `notification-core`: `.`, `./react`, `./server`, `./styles`
- `report-core`: `.`, `./contracts`, `./react`, `./server`, `./schemas`, `./styles`
- `upload-core`: `.`, `./browser`
- `upload-ui`: `.`, `./react/guard`, `./react/upload`, `./react/tray`
- `chat-core`: `.` (pure — no React/Firebase)
- `chat-react`: `.`, `./styles`
- `ttt-core`: `.`, plus app-data subpaths such as `./schemas`, `./media`, `./paths`, `./constants`, `./upload-variables`

Backend imports must not accidentally pull React, browser upload code, or app shell code into the Functions module graph. Backend chat schema/contract imports should use `chat-schemas`, not `chat-core`.

## Build order

Both build order and release order are the topological order of the dependency graph (deps before dependents) and are encoded in two places that must stay in sync: the root `package.json` `build` chain (which `scripts/build-all.sh` and `scripts/preflight.sh` delegate to) and `scripts/release-all.sh`. See `docs/packages/package-architecture.md` for the full graph and the rules below.

Build generic Tier 0 packages first, then Tier 1 (including the now-pure `chat-core`), then `ttt-core`, then `upload-ui`, then `chat-react`. `ttt-core` depends on `audit-core`, `chat-schemas`, `media-schemas`, and `report-core`, so those packages must build before `ttt-core`. `chat-react` depends on `chat-core` + the UI tier (`ui-core`, `file-input`, `upload-ui`, `media-viewer`, `mobile-core`) plus `media-schemas`/`firebase-helpers`, so it builds after all of them. When adopting from `ttt-prod`, publish the package-side changes first and then update the consuming app against installed `node_modules/@ttt-productions/*` packages.

## Release order

`scripts/release-all.sh` releases all 22 packages in the same dependency-safe order: a package publishes only after every internal `@ttt-productions/*` dependency it consumes. `chat-react` releases after `chat-core` and the UI tier; `ttt-core` after `report-core`/`audit-core`/the schema packages. Internal deps are authored `"*"` in source for workspace dev and rewritten to **caret ranges** (`^x.y.z` — across `dependencies`, `devDependencies`, AND `peerDependencies`) at pack time in CI (`scripts/pin-internal-deps.mjs`, invoked from `.github/workflows/publish.yml`); published manifests never contain `"*"` and never an exact internal pin. Caret (not exact) means bumping one package by a patch/minor does **not** force every dependent to be republished in lockstep, so a single-package patch release installs cleanly in consumers (caret on a 0.x version still locks the minor, so a breaking minor/major is not auto-adopted). The user handles version bumps and publishing.

## Release and adoption workflow

- Keep package-source changes and consuming-app adoption separate.
- Do not reference a sibling local checkout from consuming-app implementation prompts.
- The user handles version bumps, publishing, and dependency adoption.
- Run package builds/tests for every package touched.
- Regenerate lockfiles after package renames or dependency graph changes.

## Upload path invariant

See `docs/design/upload-path-invariant.md`.

## React/server safety

See `docs/design/react-safety.md`. Two dimensions, both required: (1) main entries must not *load* React at runtime; (2) client-only peers must be declared `optional` so server-only installs do not *force-install* React.

## Important rules

- Do not commit or push to git.
- Do not create source compatibility shims unless explicitly asked.
- Prefer deleting dead subpaths and stale docs during this pre-launch window.
- New generic features should use the same factory/adapter pattern as `auth-core` and the upload/backend packages.
