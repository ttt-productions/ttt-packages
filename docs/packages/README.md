# Packages

Per-package reference documentation. One file per package describing what's in it, its API surface, key types, and design decisions specific to that package.

## How to use this folder

- One file per package. Filename matches the package directory under `packages/<name>/`.
- Each doc covers: package purpose, version, dependencies, what it contains (by file or module), key design decisions, and usage examples where helpful.
- These docs are reference material for using a package — read them BEFORE diving into the package's source code.
- Per-feature design rationale stays in the relevant package doc. Cross-cutting rules (server-safe main, identity invariants, upload paths) live in `docs/design/`.

## Current packages

### Tier 0 — Zero inter-package dependencies
- `auth-core.md` — Firebase Auth wrappers, custom claims parsing, AuthProvider + hooks
- `firebase-helpers.md` — Path builders, timestamps (client + admin), batch operations, pagination
- `media-contracts.md` — Zod schemas, types, `FileOrigin` union, `TTT_MEDIA_SPECS` registry
- `mobile-core.md` — Mobile viewport, keyboard, safe area, scroll lock, pull-to-refresh
- `monitoring-core.md` — Adapter-based monitoring (Sentry browser + Sentry Node + noop)
- `query-core.md` — TanStack Query client factory, key helpers, Firestore integration hooks, search hooks
- `theme-core.md` — next-themes provider + CSS token contract for light/dark/high-contrast
- `ui-core.md` — shadcn/ui components

### Tier 1 — Depend on Tier 0 packages
- `file-input.md` — File/image/video/audio input components with cropping, validation, camera capture
- `media-viewer.md` — Media display components with fallbacks
- `notification-core.md` — Two-tier notification system (active → history)
- `report-core.md` — Report → admin task queue → resolution pipeline
- `ttt-core.md` — TTT-specific Firestore path constants, business types
- `upload-core.md` — Firebase Storage resumable uploads with queue and persistence

### Tier 2 — Depend on Tier 1 packages
- `chat-core.md` — Full chat system: realtime + infinite pagination, ChatShell, attachments
- `media-processing-core.md` — Server-side media pipeline (image/video/audio probe + transcode, moderation)

## When adding a new package

Create `<name>.md` here as part of the same change that adds the package. The doc shape should match existing package docs: purpose, version, dependencies, what it contains, design decisions. Update this README's tier listing in the same change.
