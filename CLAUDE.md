# TTT Packages — Shared Monorepo

## Overview

Shared monorepo of reusable packages published under the `@ttt-productions/*` scope.

After the package architecture rework, the monorepo has **21 packages**. Generic packages must not know about TTT-specific business identifiers, Firestore collection names, copy strings, moderation policies, or domain-event catalogs. TTT-specific data lives in `@ttt-productions/ttt-core` or in the consuming app wrapper.

Read `docs/packages/` first for package ownership. Read `docs/design/` for cross-cutting invariants such as server-safe entries, React boundaries, and upload path shape.

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

### Tier 2

- `upload-ui`

### Tier 3

- `chat-core`

### Application Data

- `ttt-core`

`ttt-core` is intentionally outside the numbered generic tiers. It can consume generic packages; generic packages cannot consume it.

## Important ownership notes

- `media-schemas` owns generic media types, media helpers, neutral media-origin spec shape, and pending-media schema factories.
- `ttt-core` owns concrete `FileOrigin`, `TTT_MEDIA_SPECS`, TTT upload wire schemas, target-info schemas, TTT pending-media schemas, domain events, and TTT atoms.
- `chat-schemas` owns pure chat schemas and server-safe chat contract constants that need to be safe for both UI and backend/schema consumers.
- `chat-core` owns the chat UI/runtime, upload adapter, and generic mention provider system.
- `upload-ui` owns guarded upload UX across explicit React subpaths: `useGuardedUpload` and the deferred form shell in `/react/upload`, local upload guard and guarded navigation helpers in `/react/guard`, and upload activity UI/provider in `/react/tray`.
- `upload-core` owns only the low-level resumable upload primitive and browser upload queue/runtime.
- `query-core` owns generic query clients/hooks plus the reusable domain-event invalidator mechanism; TTT invalidation entries stay in the app.
- `firebase-helpers/react` owns generic callable hook primitives; app wrappers own toast, monitoring, and copy.
- `rate-limit-core`, `audit-core`, and `moderation-core` own generic backend mechanisms. TTT wrappers own app-specific strings, paths, secrets, policies, and violation behavior. `ttt-core` consumes `audit-core` to specialize its generic `AuditEvent` with the TTT `AuditEventType` catalog and TTT actor/target shapes.

## Entry-point safety

Current entry shape:

- `auth-core`: `.`, `./react`, `./server`
- `firebase-helpers`: `.`, `./server`, `./react`
- `chat-schemas`: `.`
- `media-schemas`: `.`
- `mobile-core`: `.`, `./react`
- `monitoring-core`: `.`, `./react`
- `query-core`: `.`, `./react`, `./types`
- `theme-core`: `.`, `./react`, CSS subpaths
- `ui-core`: `.`, `./react`
- `file-input`: `.`, `./react`
- `media-viewer`: `.`, `./react`, `./styles`
- `media-processing-core`: `.`, `./server`
- `notification-core`: `.`, `./react`, `./server`, `./styles`
- `report-core`: `.`, `./react`, `./server`, `./schemas`, `./styles`
- `upload-core`: `.`, `./browser`
- `upload-ui`: `.`, `./react/guard`, `./react/upload`, `./react/tray`
- `chat-core`: `.`, `./react`, `./styles` plus any still-present transitional schema re-export
- `ttt-core`: `.`, plus app-data subpaths such as `./schemas`, `./media`, `./paths`, `./constants`, `./upload-variables`

Backend imports must not accidentally pull React, browser upload code, or app shell code into the Functions module graph. Backend chat schema/contract imports should use `chat-schemas`, not `chat-core`.

## Build order

Build generic Tier 0 packages first, then Tier 1, then `ttt-core`, then `upload-ui`, then `chat-core`. `ttt-core` depends on `audit-core`, `chat-schemas`, `media-schemas`, and `report-core`, so those packages must build before `ttt-core`. When adopting from `ttt-prod`, publish the package-side changes first and then update the consuming app against installed `node_modules/@ttt-productions/*` packages.

## Release and adoption workflow

- Keep package-source changes and consuming-app adoption separate.
- Do not reference a sibling local checkout from consuming-app implementation prompts.
- The user handles version bumps, publishing, and dependency adoption.
- Run package builds/tests for every package touched.
- Regenerate lockfiles after package renames or dependency graph changes.

## Upload path invariant

See `docs/design/upload-path-invariant.md`.

## React/server safety

See `docs/design/react-safety.md`.

## Important rules

- Do not commit or push to git.
- Do not create source compatibility shims unless explicitly asked.
- Prefer deleting dead subpaths and stale docs during this pre-launch window.
- New generic features should use the same factory/adapter pattern as `auth-core` and the upload/backend packages.
