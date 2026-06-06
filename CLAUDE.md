# TTT Packages — Shared Monorepo

## Overview

Shared monorepo of reusable packages published under the `@ttt-productions/*` scope.

After the package architecture rework, the monorepo has **22 packages**. Generic packages must not know about TTT-specific business identifiers, Firestore collection names, copy strings, moderation policies, or domain-event catalogs. TTT-specific data lives in `@ttt-productions/ttt-core` or in the consuming app wrapper.

Read `docs/packages/` first for package ownership. Read `docs/design/` for cross-cutting invariants such as server-safe entries, React boundaries, and upload path shape. For the one-stop model of tiers, root purity, subpath conventions, direction rules, build/release order, internal version pinning, and the boundary-guard tests, see `docs/packages/package-architecture.md`.

## Verification

`npm run test:all` is the canonical, must-pass gate for any change here — run it green BEFORE handing off a
publish list or pushing. It chains: lint → typecheck → `npx tsc -b --noEmit` → build (all 22, topo order) →
`vitest run`. The `tsc -b` step is the only one that type-checks `__tests__` (per-workspace `typecheck` and
the release preflight both skip them), so `test:all` catches latent test-file type errors nothing else does.

## Core architecture rules

1. **Generic packages do not import `ttt-core`.** If a generic package needs app-specific values, it exposes a factory, adapter, callback, schema factory, or configuration object.
2. **`ttt-core` is the application-data package.** It may depend on generic packages and composes TTT-specific schemas, constants, enums, paths, and business rules.
3. **Main entries stay server-safe.** React exports live behind `./react`; Admin SDK exports live behind `./server`; browser-only upload runtime lives behind `./browser`.
4. **No new compatibility barrels for pre-launch package moves.** Prefer canonical imports from the package that owns the concept. Delete unused transitional subpaths once grep proves there are no consumers.
5. **Code is source of truth.** Docs should explain durable ownership and rules; avoid duplicating exhaustive implementation details that will drift.

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

`scripts/release-all.sh` releases all 22 packages in the same dependency-safe order: a package publishes only after every internal `@ttt-productions/*` dependency it consumes. `chat-react` releases after `chat-core` and the UI tier; `ttt-core` after `report-core`/`audit-core`/the schema packages. Internal deps are authored `"*"` in source for workspace dev and rewritten to exact versions at pack time in CI (`scripts/pin-internal-deps.mjs`, invoked from `.github/workflows/publish.yml`); published manifests never contain `"*"`. The user handles version bumps and publishing.

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
