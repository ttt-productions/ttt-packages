# Package architecture

The one-stop reference for how the `@ttt-productions/*` monorepo is structured:
tiers, the dependency graph, root purity, subpath conventions, direction rules,
build/release order, internal version pinning, and the boundary-guard tests.

Code is the source of truth. This document explains the durable model; exact
exports live in each package's `package.json`, and the wiring lives in the root
`package.json` build chain and `scripts/`.

The monorepo has **22 packages**. Generic packages never know about TTT-specific
identifiers, Firestore collection names, copy, moderation policy, or
domain-event catalogs — that lives in `@ttt-productions/ttt-core` or in the
consuming app.

## Tier model

Tiers are a reading aid for the dependency graph; the real constraint is
"dependencies build and release before their dependents." `ttt-core` is the
application-data package: it may consume generic packages, but no generic
package may consume it.

- **Tier 0 — generic foundations (zero internal runtime deps):**
  `firebase-helpers`, `chat-schemas`, `media-schemas`, `mobile-core`,
  `monitoring-core`, `query-core`, `theme-core`, `ui-core`, `rate-limit-core`,
  `audit-core`, `moderation-core`, `auth-core`.
- **Tier 1 — depend on Tier 0 only:** `chat-core` (→ `chat-schemas`),
  `file-input` (→ `ui-core`, `media-schemas`), `media-viewer`
  (→ `media-schemas`, `ui-core`), `media-processing-core` (→ `media-schemas`),
  `upload-core` (→ `firebase-helpers`), `report-core` and `notification-core`
  (no internal runtime deps; their UI/query needs are optional peers).
- **Tier 2:** `upload-ui` (→ `file-input`, `media-schemas`, `ui-core`,
  `upload-core`).
- **Tier 3:** `chat-react` (→ `chat-core`, `chat-schemas`, `media-schemas`,
  `ui-core`, `file-input`, `upload-ui`, `media-viewer`, `mobile-core`,
  `firebase-helpers`).
- **Application data:** `ttt-core` (→ `audit-core`, `chat-schemas`,
  `media-schemas`, `report-core`).

The internal runtime-dependency edges (peers/dev excluded — they do not affect
build order):

    chat-core              -> chat-schemas
    file-input             -> ui-core, media-schemas
    media-viewer           -> media-schemas, ui-core
    media-processing-core  -> media-schemas
    upload-core            -> firebase-helpers
    upload-ui              -> file-input, media-schemas, ui-core, upload-core
    ttt-core               -> audit-core, chat-schemas, media-schemas, report-core
    chat-react             -> chat-core, chat-schemas, media-schemas, ui-core,
                              file-input, upload-ui, media-viewer, mobile-core,
                              firebase-helpers

Every other package has zero internal runtime dependencies. `ui-core`,
`report-core`, and `notification-core` declare some `@ttt-productions/*` peers
(e.g. `firebase-helpers`, `ui-core`, `query-core`) — peers are not build edges.

## Root purity rule

Every package root (`.`) is either pure/universal (server-safe, no React, no
browser Firebase, no Admin SDK, no Node-only or app-specific contract pulled in
at runtime) or it is *intentionally* a non-pure surface. Anything that is
browser/client-Firebase, React UI, Admin SDK, Node-only, or app-specific lives
behind an explicit subpath or a separate package — never the root.

Two intentional exceptions exist today, both declared in the boundary suite:
`media-processing-core` (server-only root) and `chat-react` (its root *is* the
React surface). Every other root must stay clean.

## Subpath conventions

Subpath names are consistent across packages so an import site reads its own
safety:

- `./client` — browser / client Firebase runtime (e.g. `auth-core/client`,
  `firebase-helpers/client`).
- `./firestore-client` — client Firestore helpers (`firebase-helpers`).
- `./server` — Admin SDK / Cloud Functions code.
- `./react` — React UI, hooks, providers, context.
- `./contracts` — pure, dependency-light contracts/schemas (e.g.
  `report-core/contracts`, consumed by `ttt-core` and Cloud Functions).
- `./browser` — browser upload runtime (`upload-core/browser`).
- `./styles` (or `*.css`) — CSS assets.

## Direction rules

- Generic packages must not import `ttt-core`. If a generic package needs
  app-specific values, it exposes a factory, adapter, callback, schema factory,
  or configuration object (the `auth-core` / upload / backend pattern).
- Pure schema packages (`chat-schemas`, `media-schemas`) stay pure Zod/TS with
  zero `@ttt-productions/*` runtime deps.
- UI packages must not import server (`./server` / Admin SDK) packages.
- Server packages must not import React/UI.
- No dependency cycles.
- Backend chat schema/contract imports use `chat-schemas`, not `chat-core`.

## chat-core vs chat-react

`chat-core` is the **pure** package: chat contracts, the mention
parser/serializer, grouping helpers, and the generic mention-provider contract.
Its only dependency is `chat-schemas` — no React, no Firebase, no UI. A Cloud
Function, script, or future native/TV client can consume the parser and
contracts without dragging in the frontend tree. There is no `chat-core/react`
or `chat-core/schemas` subpath; `chat-core` exposes only `.`.

`chat-react` holds everything React: the chat shell/composer/list UI, the
realtime + infinite-older hooks, the mention autocomplete UI, the name-resolver
context, the Firebase-client adapter config types (`ChatCoreConfig`,
`ChatUploadAdapter`, …), and the render-callback types (`MessageRenderer`,
`RenderableMentionProvider`, …). It depends on `chat-core` plus the UI tier and
treats `react` / `react-dom` / `firebase` / `@tanstack/react-query` /
`lucide-react` as optional peers. Non-React consumers install `chat-core` and
never inherit the frontend tree.

## auth-core generics

`createAssertAuth<TUser, TAdmin>(config)` and `AuthContext<TUser, TAdmin>` are
generic over both the consuming app's user-document shape and its admin-check
result type. The package stays app-agnostic: the consumer supplies the role
type and the `requireAdmin` callback. When a callable passes
`requirements.admin`, the factory delegates to `config.requireAdmin` and
surfaces the returned value on `ctx.admin` (left `undefined` when no admin check
ran). App-specific role logic and Firestore paths are wired at the consuming
app's boundary, never inside `auth-core`.

## Build order and release order

Both orders are the topological order of the runtime-dependency graph above:
a package builds (and releases) only after every internal dependency it
consumes. The order is encoded in two places that must stay in sync whenever a
package is added, renamed, or removed:

- the root `package.json` `build` chain — the single source of build order;
  `scripts/build-all.sh` and `scripts/preflight.sh` delegate to it rather than
  re-listing packages.
- `scripts/release-all.sh` — releases all 22 packages in the same order.

Key ordering constraints: `chat-schemas` before `chat-core`; `chat-core` plus
the UI tier (`ui-core`, `file-input`, `upload-ui`, `media-viewer`,
`mobile-core`) plus `media-schemas`/`firebase-helpers` before `chat-react`;
`report-core`/`audit-core`/`media-schemas`/`chat-schemas` before `ttt-core`;
`firebase-helpers` before `upload-core`; `file-input`/`ui-core`/`upload-core`/
`media-schemas` before `upload-ui`.

`scripts/preflight.sh` (and `release-all.sh`, which preflights once) nukes stale
nested `node_modules/@ttt-productions` shadows and `dist/` before a fresh
install + full build, so workspace symlinks resolve and no consumer reads stale
`dist/`. `scripts/bundle-code.sh` and `scripts/zip-ttt-packages.sh` discover
packages dynamically by globbing `packages/*`, so they need no per-package edits.

## Internal version pinning

Internal `@ttt-productions/*` dependencies are authored `"*"` in source so that
workspace dev always resolves to the local package. A published tarball must
never ship `"*"` (it would let a consumer resolve an incompatible newer internal
version), so the release pipeline rewrites every internal `"*"` to a **caret
range** (`^x.y.z`) at pack time — across `dependencies`, `devDependencies`, AND
`peerDependencies`:

- `scripts/release-package.sh` bumps the version, commits, tags, and pushes —
  the tag triggers CI. It does not pin; committed source keeps `"*"`.
- `.github/workflows/publish.yml` runs `scripts/pin-internal-deps.mjs <pkgDir>`
  on the ephemeral checkout to rewrite `"*"` → caret pins, then re-runs it with
  `--check` to **hard-fail** if any internal `"*"` survived, then `npm publish`.

Caret, not exact: bumping one internal package by a patch/minor must not force
every dependent to be republished in lockstep. Exact pins caused exactly that
cascade — a stale exact regular dep surfaced as a duplicate nested install, and a
stale exact peer dep as a `peerOptional` ERESOLVE warning, in the consuming app
until the dependent was also republished. Caret on a `0.x` version still locks
the minor, so a breaking minor/major is never auto-adopted — only compatible
patches flow through. Because the checkout is ephemeral, the rewrite affects only
the published tarball; the repo keeps `"*"`.

## Boundary guard tests

The Step-0 boundary suite lives in `test/boundary/` (its own
`vitest.config.ts`) and runs as part of the workspace test fan-out. It encodes
the rules above so they fail loudly:

- `root-runtime-leak.test.ts` (check #1) — for every package marked `hard` in
  `leak-config.ts`, fails if the built root entry (`dist/index.js`)
  transitively pulls a client/browser runtime (`react`, `firebase/*`, `next`,
  `@tanstack/react-query`, `lucide-react`, or any `*.css`). `media-processing-core`
  and `chat-react` are `exempt` (intentionally non-pure roots). It warns rather
  than fails when `dist/` is not built, so build the packages first.
- `internal-star-range.test.ts` (check #2) — **report-only** audit of
  `@ttt-productions/*: "*"` ranges in source manifests. Source `"*"` is expected;
  the hard-fail against published output lives in the release flow
  (`pin-internal-deps.mjs --check`), not here.
- `docs-export-sync.test.ts` (check #3) — fails if any markdown under `docs/`
  or a package `README.md` references a package subpath
  (`@ttt-productions/<pkg>/<subpath>`, or a leading `` `./subpath` `` entry
  declaration in `docs/packages/<pkg>.md`) that is not present in that package's
  `exports`. This is what catches a stale `chat-core/schemas` or removed
  `chat-core/react` reference after the concept moves.
