# TTT Packages — Shared Monorepo

## Overview
Shared monorepo of reusable packages consumed by TTT Productions and Q-Sports. Published to npm under the `@ttt-productions` scope. Contains 16 packages providing common functionality across projects.

**For detailed documentation on each package, see `docs/packages/`.**
Reading those docs should be sufficient for most tasks — only look at package source code when debugging specific issues or making targeted changes.

## Tech Stack
- TypeScript (strict mode)
- React 19 (for UI/hook packages)
- Firebase (client SDK + Admin SDK for server-side packages)
- npm workspaces for monorepo management
- GitHub Actions for automated publishing via git tags
- Node >=22, npm >=10

## Package Tiers & Dependency Graph

### Tier 0 — Zero inter-package dependencies
- `auth-core` — Firebase Auth wrappers, custom claims parsing, AuthProvider + hooks
- `firebase-helpers` — Firestore path builders, timestamps (client + admin), batch operations, pagination, date formatting
- `media-contracts` — Zod schemas, TypeScript types, the `FileOrigin` union, the `PendingFile` interface, and the `TTT_MEDIA_SPECS` registry for the media processing pipeline (no runtime deps beyond zod)
- `mobile-core` — Mobile viewport, keyboard, safe area, scroll lock, pull-to-refresh, iOS Safari fixes
- `monitoring-core` — Adapter-based monitoring (Sentry browser + Sentry Node + noop)
- `query-core` — TanStack Query client factory, key helpers, Firestore integration hooks, search hooks
- `theme-core` — next-themes provider + CSS token contract for light/dark/high-contrast
- `ui-core` — shadcn/ui components (Button, Card, Dialog, Toast, Tabs, Form, etc.)

### Tier 1 — Depend on Tier 0 packages
- `file-input` — File/image/video/audio input components with cropping, validation, camera capture (depends on ui-core, media-contracts)
- `media-viewer` — Media display components (image, video, audio) with fallbacks (depends on media-contracts, ui-core)
- `notification-core` — Two-tier notification system: active → history with dedup, batch processing, UI components (peer deps on query-core, ui-core)
- `report-core` — Report → admin task queue → resolution pipeline with priority scoring, UI components (peer deps on query-core, ui-core)
- `ttt-core` — TTT Productions-specific Firestore path constants, TypeScript types, shared business constants (depends on media-contracts for `FileOrigin`/`PendingFile`, used by `ContentViolation`)
- `upload-core` — Firebase Storage resumable uploads with queue, progress tracking, persistence (depends on firebase-helpers)

### Tier 2 — Depend on Tier 1 packages
- `chat-core` — Full chat system: realtime newest-window + infinite older pagination, ChatShell, Composer, attachments (depends on ui-core, firebase-helpers, mobile-core, file-input, upload-core, media-viewer, media-contracts)
- `media-processing-core` — Server-side media pipeline: image resize/format, video/audio probe + transcode, moderation adapter, temp workspace (depends on firebase-helpers, media-contracts, sharp)

## Project Structure
```
packages/{name}/src/       — Source TypeScript
packages/{name}/dist/      — Compiled output (not committed)
packages/{name}/package.json
docs/packages/{name}.md    — Package documentation (read these first!)
scripts/                   — Release and bundle scripts
```

## Build Order (dependency-safe)
1. ui-core, theme-core, query-core, monitoring-core, firebase-helpers, media-contracts
2. ttt-core, mobile-core, media-viewer, file-input, auth-core
3. upload-core, notification-core, report-core
4. chat-core, media-processing-core

Note: ttt-core now depends on media-contracts (for FileOrigin/PendingFile), so media-contracts must build first.

## Release Process
- `scripts/release-package.sh` — Release a single package (bumps version, tags, pushes)
- `scripts/release-all.sh` — Release all packages in dependency order
- Tags format: `{package-name}-v{version}` (e.g., `chat-core-v1.2.3`)
- GitHub Actions publishes to npm on tag push
- Both release scripts call `npm run preflight` automatically — never skip it, never bypass it by calling `npm publish` directly.

## Dual Entry Points
Several packages export both client-side and server-side code via separate entry points:
- `firebase-helpers` — `index.ts` (client SDK) + `admin/index.ts` (Admin SDK)
- `notification-core` — `index.ts` (React hooks/components) + `server/index.ts` (Cloud Function helpers)
- `report-core` — `index.ts` (React hooks/components) + `server/index.ts` (Cloud Function handlers)
- `media-processing-core` — Server-only (Node.js, uses sharp + ffmpeg)

## CSS Architecture (theme-core)
- Consumer apps import theme-core's `styles.css` + `components.css` first, then override with brand.css
- All colors use `hsl(var(--token-name))` pattern
- Semantic CSS classes over inline Tailwind; centralized in `components.css` with project-specific prefixes

## Coding Conventions
- All timestamps use epoch milliseconds (`Date.now()`) — not Firestore Timestamps in app code
- `toMillis()` in firebase-helpers handles conversion from any Firestore timestamp format
- Path utilities (`colPath`, `docPath`, `joinPath`) in firebase-helpers for generic Firestore paths
- `PATH_BUILDERS` in ttt-core for TTT Productions-specific document paths (returns tuples)
- Every package must compile cleanly with `npm run build`
- Exports must be listed in package.json `exports` field

## Upload Path Invariant (Phase 1, LAW)

Every file uploaded anywhere in the TTT Productions ecosystem MUST follow this storage path shape:

    uploads/{fileOrigin}/{uid}/{pendingMediaDocId}

Rules:
- No extension on the storage path.
- `fileOrigin` is always kebab-case and must be a value in the `FileOrigin` union in `media-contracts`.
- The filename segment is the pendingMedia Firestore document ID (uuid).
- Firestore rule on `pendingMedia` enforces strict equality — regex was replaced with `==`.
- `contentType` must be a valid `image/*`, `video/*`, or `audio/*`. `application/octet-stream` is rejected.

Defense in depth:
1. `file-input` ensures every File it emits has a valid contentType via `ensureFileWithContentType` (checks file.type, falls back to extension lookup, then kind-default).
2. `upload-core` throws `UploadError('missing_content_type')` or `UploadError('invalid_content_type')` before any bytes hit storage.
3. Firestore rules enforce the path equality and fileOrigin allowlist.
4. Storage rules enforce the contentType regex.

If you change any part of this invariant, you must update `firestore.rules`, the `FileOrigin` type in `media-contracts`, this CLAUDE.md section, and every upload mutation in lockstep. There is no partial migration.

## Build & Run Commands
- `npm install` — Install all workspace dependencies
- `npm run build` — Build all packages in dependency order
- `npm run build -w @ttt-productions/{package}` — Build a specific package
- `npm run clean` — Clean all dist directories
- `npm run test` — Run all Vitest tests

## Testing
- `packages/{name}/src/**/*.test.ts(x)` — Unit tests colocated with source
- React component packages use Vitest + React Testing Library
- Pure utility packages use Vitest only
- Bug-fix-requires-test policy: fixes should be accompanied by regression tests

## Important Rules
- Do NOT commit or push to git — I will review and commit manually.
- Do NOT create documentation files unless explicitly asked.
- Keep changes minimal and focused on what was asked.
- Changes to package exports affect both TTT Productions and Q-Sports — be careful.
- Run `npm run build -w @ttt-productions/{package}` after changes to verify compilation.
- Packages with server exports (notification-core, report-core) use firebase-admin types — don't mix client/admin SDK imports.
