# TTT Packages — Shared Monorepo

## Overview
Shared monorepo of reusable packages consumed by TTT Productions and Q-Sports. Published to npm under the `@ttt-productions` scope. Contains 14 packages providing common functionality across projects.

## Tech Stack
- TypeScript
- React (for UI packages)
- Firebase (client SDK — for firebase-helpers, auth-core, etc.)
- npm workspaces for monorepo management
- GitHub Actions for automated publishing via git tags

## Packages

### Foundation (no inter-package dependencies)
- `ui-core` — shadcn/ui components (Button, Card, Dialog, Toast, etc.)
- `theme-core` — CSS tokens, variables, semantic classes for light/dark mode
- `query-core` — React Query key factories and utilities
- `monitoring-core` — Sentry integration, breadcrumbs, exception capture
- `firebase-helpers` — Firestore utilities: toMillis, formatDate, batch operations, path builders, timestamps

### Mid-Level (depend on foundation packages)
- `media-contracts` — Shared types/interfaces for media processing
- `media-viewer` — Media display components
- `chat-core` — Chat UI components and hooks
- `file-input` — File upload input components with validation

### High-Level (depend on mid-level packages)
- `auth-core` — Firebase Auth integration, AuthProvider, login/register components
- `mobile-core` — Mobile-specific utilities, touch handling, viewport helpers
- `upload-core` — Firebase Storage upload with progress tracking
- `media-processing-core` — Media processing pipeline (resize, compress, validate)
- `notification-core` — Notification system components and hooks

## Project Structure
- `packages/` — All 14 packages
- `packages/{name}/src/` — Source TypeScript
- `packages/{name}/dist/` — Compiled output
- `packages/{name}/package.json` — Package manifest
- `scripts/` — Release and bundle scripts

## Build Order (dependency-safe)
1. ui-core, theme-core, query-core, monitoring-core, firebase-helpers
2. media-contracts, media-viewer, chat-core, file-input
3. auth-core, mobile-core
4. upload-core, media-processing-core

## Release Process
- `scripts/release-package.sh` — Release a single package (bumps version, tags, pushes)
- `scripts/release-all.sh` — Release all packages in dependency order
- Tags format: `{package-name}-v{version}` (e.g., `chat-core-v1.2.3`)
- GitHub Actions publishes to npm on tag push

## CSS Architecture (theme-core)
- `theme-core/styles.css` — Base CSS tokens and variables for light/dark mode
- `theme-core/components.css` — Shared component CSS classes
- Consumer apps import these first, then override with their own brand.css
- All colors use `hsl(var(--token-name))` pattern
- Both light and dark mode must be supported for all tokens

## Coding Conventions
- All timestamps use numbers (`Date.now()`) — not Firestore Timestamps
- `toMillis()` in firebase-helpers handles all timestamp format conversions
- Path utilities (`colPath`, `docPath`) in firebase-helpers for Firestore paths
- Every package must compile cleanly with `npm run build`
- Exports must be listed in package.json `exports` field

## Build & Run Commands
- `npm install` — Install all workspace dependencies
- `npm run build -w @ttt-productions/{package}` — Build a specific package
- `npm run clean` — Clean all dist directories
- `npm run test` — Run all Vitest tests
- `npm run test:unit` — Unit tests only

## Testing

### Test Structure
- `packages/{name}/src/**/*.test.ts(x)` — Unit tests per package
- React component packages (ui-core, chat-core, file-input, media-viewer, auth-core, mobile-core, upload-core) use Vitest + React Testing Library
- Pure utility packages (firebase-helpers, query-core, theme-core, monitoring-core, media-contracts, media-processing-core) use Vitest only

### When Modifying Code
- If you change a utility function, update its test
- If you change a component's props or exports, update its test
- If you change a package's public API (exports), flag that consuming apps may need updates
- When adding new exports, create corresponding tests

## Important Rules
- Do NOT commit or push to git. I will review and commit manually.
- Do NOT create documentation files unless explicitly asked.
- Do NOT add unnecessary comments explaining what you changed.
- Keep changes minimal and focused on what was asked.
- Changes to package exports affect both TTT Productions and Q-Sports — be careful.
- Run `npm run build -w @ttt-productions/{package}` after changes to verify compilation.