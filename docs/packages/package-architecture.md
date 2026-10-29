# Package architecture

The one-stop reference for how the `@ttt-productions/*` monorepo is structured:
tiers, the dependency graph, entry purity, imports inside a package, subpath conventions, direction rules,
build/release order, internal version pinning, and the boundary-guard tests.

Code is the source of truth. This document explains the durable model; exact
exports live in each package's `package.json`, and the wiring lives in the root
`package.json` build chain and `scripts/`.

Generic packages never know about any app's identifiers, Firestore collection
names, copy, moderation policy, or domain-event catalogs — that lives in the app's
application-data package (`@ttt-productions/ttt-core`, `@ttt-productions/q-core`) or in the
consuming app.

## Tier model

Tiers are a reading aid for the dependency graph; the real constraint is
"dependencies build and release before their dependents." `ttt-core` and `q-core`
are the application-data packages: each may consume generic packages, but no generic
package may consume either.

- **Tier 0 — generic foundations (zero internal runtime deps):**
  `input-format-core` (the named text-input formats, a field's format/min/max
  declaration, and the one check every text input and server bound runs; no
  dependencies at all), `module-core` (`lazyModule`, the one memoized dynamic
  import every lazy load goes through; no dependencies at all), `firebase-helpers`, `chat-core`, `media-schemas`,
  `mobile-core`, `monitoring-core`, `theme-core`, `rate-limit-core`,
  `audit-core`, `moderation-core`, `auth-core`, `edge-protocol-core`
  (runtime-neutral signed-edge-call primitives plus the factories a consumer
  defines its own header sets with; WebCrypto + zod only), `repo-guards` (the one guard suite every app runs in
  its gate: one reader of the repository, every generic guard, and the three shapes
  an app builds its business guards on, and the repository tooling every app runs; its root is
  pure; its `./node` reader and the `./node/suite`, `./node/reports`, and `./node/tooling`
  entries run under Node), `dev-standards` (the shared rulebook, AI docs, workflows,
  playbooks, and config bases every product reads; its docs ship as plain files, and its
  `./node/*` config bases run under Node).
- **Tier 1 — depend on Tier 0 only:**
  `ui-core` (→ `input-format-core`; its free-text inputs take a field
  declaration), `chat-schemas` (→ `input-format-core`; the chat message text's
  declaration and judgement), `report-core` (→ `firebase-helpers`, `input-format-core`;
  its queue handlers take the `firebase-helpers/server` Firestore contract, and the report
  comment's check — its UI/query needs are optional peers), `media-processing-core`
  (→ `media-schemas`), `upload-core` (→ `firebase-helpers`, `media-schemas`),
  `query-core` (→ `firebase-helpers`; its id-list batch loader splits by
  `FIRESTORE_IN_FILTER_LIMIT`, and its `./react` callable factories call `callCallable` from
  `firebase-helpers/client`),
  `realtime-core` (→ `edge-protocol-core`; generic runtime-neutral realtime
  primitives), `notification-core` (→ `firebase-helpers`; its server helpers take the
  `firebase-helpers/server` Firestore contract — its UI/query needs are optional peers).
- **Tier 2:** `media-viewer` (→ `media-schemas`, `ui-core`), `file-input`
  (→ `ui-core`, `media-schemas`, `media-viewer`), `consent-core` (no internal runtime deps; its
  `./react` entry builds on the optional peers `theme-core` and `ui-core`).
- **Tier 3:** `upload-ui` (→ `file-input`, `media-schemas`, `ui-core`,
  `upload-core`).
- **Tier 4:** `chat-react` (→ `chat-core`, `chat-schemas`, `realtime-core`,
  `ui-core`, `upload-ui`, `mobile-core`, `firebase-helpers`). The `realtime-core`
  edge is the realtime (Durable Object) chat transport client; `realtime-core` is
  Tier 1 so it already builds before `chat-react`. The `upload-ui` edge is the
  in-flight-send navigation guard only — chat is text-only and runs no upload
  path, which is why it has no `file-input` / `media-viewer` / `media-schemas`
  edge.
- **Application data:** `ttt-core` (→ `audit-core`, `chat-schemas`,
  `edge-protocol-core`, `input-format-core`, `media-schemas`, `notification-core`,
  `report-core`) for ttt-prod, and `q-core` (→ `input-format-core`, `media-schemas`,
  `notification-core`, `theme-core`) for Q-Sports. Each is governed by its own app's
  rulebook (RULE-STD-ARCH-207), and neither imports the other.

The internal runtime-dependency edges (peer and dev edges are left out here; the
build and release order still honors them):

    ui-core                -> input-format-core
    chat-schemas           -> input-format-core
    report-core            -> firebase-helpers, input-format-core
    realtime-core          -> edge-protocol-core
    file-input             -> ui-core, media-schemas, media-viewer
    media-viewer           -> media-schemas, ui-core
    media-processing-core  -> media-schemas
    upload-core            -> firebase-helpers, media-schemas
    query-core             -> firebase-helpers
    notification-core      -> firebase-helpers
    upload-ui              -> file-input, media-schemas, ui-core, upload-core
    ttt-core               -> audit-core, chat-schemas, edge-protocol-core,
                              input-format-core, media-schemas,
                              notification-core, report-core
    q-core                 -> input-format-core, media-schemas,
                              notification-core, theme-core
    chat-react             -> chat-core, chat-schemas, realtime-core,
                              ui-core, upload-ui, mobile-core, firebase-helpers

The `file-input -> media-viewer` edge is the only intra-tier dependency (both
Tier 2; `file-input` renders `MediaPreview` in `MediaInput`'s selected-file preview).
It needs no tier renumbering: the one package order (see Build order and release
order) already places `media-viewer` before `file-input`, so dependencies still
build and release before their dependents.

Every other package has zero internal runtime dependencies. `ui-core`,
`report-core`, `notification-core`, `consent-core`, `upload-ui`, and `chat-react` declare some
`@ttt-productions/*` peers (e.g. `firebase-helpers`, `ui-core`, `query-core`, `theme-core`) —
a peer is not a runtime edge, but a package whose source imports one compiles
against its `dist`, so the peer still builds and releases first.

## Entry purity rule

Every package entry not declared runtime-specific (the subpaths under Subpath
conventions) is pure/universal: no Node, React, or browser runtime import or
type — `node:*` included — in its built JS or its `.d.ts`, and no app-specific
contract pulled in at runtime. Anything that is browser/client-Firebase, React
UI, Admin SDK, Node-only, or app-specific lives behind a runtime-specific
subpath or a separate package (RULE-STD-ARCH-202, RULE-STD-ARCH-203).

A runtime-specific entry is held to its own runtime the same way: a Node entry
reaches no React or browser runtime, a browser entry no Node or React, and a
React entry no Node — a `./<runtime>/testing` entry and a declared exception
included.

Three intentional exceptions exist, each declared in the boundary suite:
`media-processing-core` (server-only root), `chat-react` (its root *is* the
React surface), and `ttt-core`'s `./safety` (Node-only). Every other entry must
stay clean. The native-load check runs over exactly the entries this rule calls
universal or server.

## Imports inside a package

Inside a package, code imports the file that defines each name — never a folder
`index`, a nested entry, or the package's own name. Tests do the same, except that
an entry-surface test may import an entry `index` to prove it forwards a name.
Every relative import, in source and tests alike — a static import, an
`export … from`, an `import()`, and a test runner's module mock — names its file
with its built extension: `./x.js` for `x.ts` or `x.tsx`, `./folder/index.js` for a
folder (source must under `node16` resolution; tests follow the same one style).
Only an entry `index` re-exports, and only files in its own subtree, each named
directly; an index declares nothing of its own, and no `index.ts` exists that
is not a package entry (RULE-STD-ARCH-203). An
entry-surface test is a file named `<name>.entry.test.ts`; no other test imports
an entry index.

## Subpath conventions

Every definition a package exports is exported by exactly one entry — the entry of the folder that
holds it. A file-level entry exists only for a file no folder entry covers, and a root-level file
with no entry of its own belongs to the root, so the root never forwards what a folder entry exports
(RULE-STD-ARCH-203; the repo-guards package-entry check holds it in the boundary suite).

Subpath names are consistent across packages so an import site reads its own
safety:

- `./client` — browser / client Firebase runtime (e.g. `auth-core/client`,
  `firebase-helpers/client`).
- `./firestore-client` — client Firestore helpers (`firebase-helpers`).
- `./server` — Admin SDK / Cloud Functions code.
- `./react` — React UI, hooks, providers, context.
- `./contracts` — pure, dependency-light contracts/schemas (e.g.
  `report-core/contracts`, consumed by `ttt-core` and Cloud Functions).
- `./browser` — browser runtime with no React: the upload runtime (`upload-core/browser`), the
  reload-recovery watch (`ui-core/browser`), and the browser monitoring init
  (`monitoring-core/browser`).
- `./styles` (or `*.css`) — CSS assets.
- `./<runtime>/testing` — a package's test doubles and builders for that runtime
  (`firebase-helpers/server/testing`, `…/firestore-client/testing`, `query-core/react/testing`). Its
  first segment declares its runtime, and an entry that needs a test runner declares `vitest` an
  optional peer. The boundary suite's `entryPurity` names `testing` its test-runner segment: such an
  entry is held to its runtime's purity but never loaded in a plain Node process, since it evaluates
  only inside the runner.
- `./node/<tool>` — a Node-only config base named for the tool it configures
  (`dev-standards/node/eslint`, `…/node/vitest`, `…/node/playwright`, `…/node/postcss`, `…/node/a11y`).
- `./config/<file>.json` — a JSON config file exported by its own path for `extends`
  (`dev-standards/config/tsconfig.app.json`, `…/config/tsconfig.functions.json`,
  `…/config/prettier.json`).

## Direction rules

- Generic packages must not import `ttt-core` or `q-core`. If a generic package needs
  app-specific values, it exposes a factory, adapter, callback, schema factory,
  or configuration object (the `auth-core` / upload / backend pattern).
- Pure schema packages (`chat-schemas`, `media-schemas`) stay pure Zod/TS. Their
  only allowed `@ttt-productions/*` runtime dependency is `input-format-core` —
  itself dependency-free and server-safe — so a text bound they own runs the same
  check as every other text input (`chat-schemas` judges a chat message's text
  with it). Nothing else, so a backend importing a schema package never inherits
  another package's graph.
- UI packages must not import server (`./server` / Admin SDK) packages.
- Server packages must not import React/UI.
- No dependency cycles, and no runtime import cycle between a package's own
  modules (the repo-guards cycle check, run on the import-paths analyzer's parse).
- A foundation never depends on its adapters. The boundary suite fails a generic
  package that imports `ttt-core` or `q-core`.
- Backend chat schema/contract imports use `chat-schemas`, not `chat-core`.

**Sanctioned exceptions** — one generic package carries app-branded strings. Each is
a **wire-protocol token**, not business policy or app config: the literal value on the network
that independently deployed runtimes and every browser must agree on, so it belongs with the
protocol it defines, and renaming it is a protocol break rather than a refactor. Each is
single-declared in its owning package, imported everywhere else (RULE-STD-ENG-002), and marked by a
one-line `RULE-STD-ARCH-201` exception comment above its declaration. Do not "fix" them by relocating
the value to `ttt-core`.

- `chat-schemas` → `CHAT_SUBPROTOCOL` (`ttt.chat.v1`), the pinned WebSocket
  subprotocol tag, and `CHAT_GRANT_AUDIENCE` (`ttt-chat`), the grant token's
  `aud` claim. Every runtime that offers or verifies them must agree on the
  literal value.

## Firestore access goes through query-core

React packages read and write Firestore through `@ttt-productions/query-core`'s
hooks — `useFirestoreDoc`, `useFirestoreCollection` (one-shot or realtime via
`subscribe`), `useFirestoreInfinite`, `useFirestorePaginated`, `useFirestoreCount`,
`useFirestoreLiveInfinite`, `useBatchFirestoreDocs`, and the `useFirestore*`
mutations — rather than calling `firebase/firestore` operations (`getDoc(s)`,
`onSnapshot`, `getCountFromServer`, `setDoc`/`updateDoc`/`writeBatch`, …) directly.
`db` comes from one shared `<FirestoreProvider>`, so a package never takes its own
`db`. Building constraints with `where`/`orderBy`/`limit` and importing Firestore
*types* is fine — only the runtime operations route through query-core.

A package that needs those hooks declares `@ttt-productions/query-core` as an
**optional peer** so the consuming app supplies the single instance (preserving
`FirestoreProvider` context identity) — see `report-core`, `notification-core`,
`upload-ui`, `chat-react`. `firebase-helpers` (low-level Firestore primitives) and `query-core`
itself are the two layers that intentionally call `firebase/firestore` directly:
they are the abstraction, not consumers of it.

**Sanctioned exceptions** — each carries an in-file `SANCTIONED EXCEPTION` block;
do not "migrate" them onto query-core without preserving the behavior the comment
describes:

- `upload-ui` → `react/tray` in-flight-uploads-provider: needs `onSnapshot`
  *transition events* (`docChanges()` added/modified/removed) for one-shot
  terminal callbacks and initial-snapshot suppression, which a "current list"
  hook cannot express. The subscription is already abstracted behind an injectable
  `FirestoreSubscribeFn`, so the direct firebase path is confined to
  `defaultFirestoreSubscribe` and is swappable; a static ESM `firebase/firestore`
  import is load-bearing there for Next.js + Turbopack module identity.

## chat-core vs chat-react

`chat-core` is the **pure** package: chat contracts and grouping helpers. It has
**zero internal runtime dependencies** — no `@ttt-productions/*` edge, no React,
no Firebase, no UI. A Cloud Function, script, or future native/TV client can
consume the contracts without dragging in the frontend tree. There is no
`chat-core/react` or `chat-core/schemas` subpath; `chat-core` exposes only `.`.

`chat-react` holds everything React: the chat shell/composer/list UI, the
realtime + infinite-older hooks, the name-resolver context, the adapter config
types (`ChatCoreConfig`), and the render-callback types (`MessageRenderer`, …).
It depends on `chat-core` plus the UI tier and treats `react` / `react-dom` /
`firebase` / `@tanstack/react-query` / `lucide-react` as optional peers.
Non-React consumers install `chat-core` and never inherit the frontend tree.

Neither package carries mention machinery. Chat message text is PLAIN text —
stored and rendered verbatim, with no token grammar, parser, serializer,
autocomplete UI, or mention-provider contract on either side of the split.
Mentions belong to the consuming app: its application-data package holds the
atoms, and the surface that uses them is the app's own.

Neither package carries **reply-to** machinery either. No chat surface has an
authoring affordance for replying to a specific message — `MessageActions`
renders only Report and the composer's `onSend` takes text alone — so
`ChatMessageV1` has no `replyTo` field, there is no reply-quote renderer or
stylesheet, and no send path (Firestore callable or DO socket frame) carries a
reply pointer. A DO row that still stores a legacy
`replyTo` column is ignored by the mapper.

## auth-core generics

`createAssertAuth<TUser, TAdmin, TAdminOptions>(config)` and `AuthContext<TUser, TAdmin>` are
generic over the consuming app's user-document shape, its admin-check result
type, and its admin-check options type. The package stays app-agnostic: the
consumer supplies those types and the `requireAdmin` callback. When a callable passes
`requirements.admin`, the factory delegates to `config.requireAdmin` and
surfaces the returned value on `ctx.admin` (left `undefined` when no admin check
ran). App-specific role logic and Firestore paths are wired at the consuming
app's boundary, never inside `auth-core`. The optional acceptance-level gate
follows the same pattern: the app supplies the claim name and the required-level
reader through `config.acceptance`; the package only compares the two levels
(see `auth-core.md`).

## Build order and release order

Build and release follow one order: every package comes after each internal
`@ttt-productions/*` package it declares (runtime, dev, or peer), so it compiles
against a built `dist` and never publishes a caret range to a version npm does
not have yet. That order is written in one place, the root `package.json` `build`
chain, so adding, renaming, or removing a package means editing that chain only:

- `npm run build` runs the chain; `scripts/build-all.sh` and
  `scripts/preflight.sh` delegate to it rather than re-listing packages.
- `scripts/package-order.mjs` prints the chain as package folder names, one per
  line. `scripts/release-multiple.sh` releases a selected subset in that order,
  and `scripts/release-all.sh` hands every package folder to
  `release-multiple.sh`.
- `package-order.test.ts` (see Boundary guard tests) fails when the chain misses
  a package or puts one ahead of an internal package it declares.

`scripts/preflight.sh`, which every release runs once before its first package,
nukes stale nested `node_modules/@ttt-productions` shadows and `dist/` before an
install + full build, so workspace symlinks resolve and no consumer reads stale
`dist/`. `scripts/bundle-code.sh` and `scripts/zip-ttt-packages.sh` discover
packages dynamically by globbing `packages/*`, so they need no per-package edits.

## Published sourcemaps

Published JavaScript sourcemaps are self-contained: the root TypeScript config
keeps `sourceMap` and `inlineSources` enabled so every emitted `.js.map` carries
the original TypeScript in `sourcesContent`. Package tarballs publish `dist` and
no TypeScript source (`publish-manifest.test.ts` enforces both); a map that only
points back to `src` produces missing-source
warnings in consumers and degrades stack traces. Do not fix that by dropping
sourcemaps or broadly adding source trees to package tarballs.

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

The boundary suite lives in `test/boundary/` (its own `vitest.config.ts`) and runs
in the workspace test fan-out, so the package gate fails loudly when a rule in this
doc — or a repo-wide rule the gate holds — is broken. Every test file there guards
one rule, and its own title says which: a hand-written file through its `describe`
title, a file that registers a repo-guards guard through that guard's title. Read
the file for what it checks; this doc does not list them. A new rule that can be
checked gets its file in the same change.

Three behaviors matter when changing packages:

- `package-imports.test.ts` checks package structure against the built `dist/`, so
  the build runs first and an entry that is not built fails. The runtime-specific
  subpaths and the declared Entry purity exceptions are facts written in this file.
- `docs-export-sync.test.ts` fails any package subpath a doc or package `README.md`
  names, and any `` `./subpath` `` entry bullet in `docs/packages/<pkg>.md`, that is
  not in that package's `exports` — so removing or renaming an entry updates its docs
  in the same change.
- `package-order.test.ts` fails a package missing from the root `package.json` build
  chain or placed ahead of an internal package it declares — so adding, renaming, or
  removing a package edits that chain.
