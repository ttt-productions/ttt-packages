# Adopt @ttt-productions/firebase-helpers 0.12.24

**What:** `getAdminApp()` loads Auth, Storage, and the `firebase-admin` root only on first read.
**Severity:** low
**Came from:** the ttt-prod decided-work-items session (one combined package release)

- **Package and version:** `@ttt-productions/firebase-helpers` 0.12.24.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards ui-core ttt-core file-input firebase-helpers query-core patch`.
- **What changed:**
  - `@ttt-productions/firebase-helpers/server` `getAdminApp()` loads Firestore eagerly; its `auth`, `storage`, and `admin` handles are getters that load their module the first time they are read. The returned shape and names are unchanged.
- **What the app must change:** Install. To get the cold-start saving, the app's Functions read `.auth` / `.storage` where they use them, never at module scope (for example, an `export const auth = getAdminApp().auth` becomes a function such as `adminAuth()` called at the use site).
- **Done when:** The lockfiles name `@ttt-productions/firebase-helpers` 0.12.24 or later, no Functions module reads `.auth` or `.storage` at load, and the gate is green.
