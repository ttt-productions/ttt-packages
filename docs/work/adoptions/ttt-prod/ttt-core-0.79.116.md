# Adopt @ttt-productions/ttt-core 0.79.116

**What:** The admin views that need full admin are declared once.
**Severity:** low
**Came from:** the ttt-packages shared-standards run (the core-union guard in ttt-prod)

- **Package and version:** `@ttt-productions/ttt-core` 0.79.116.
- **Release:** `./scripts/release-multiple.sh report-core repo-guards ttt-core patch`.
- **What changed:** `FULL_ADMIN_ONLY_VIEWS` (`safetyCaseConsole`, `publicDocuments`, `systemSlots`) in `constants/admin-views`, beside `ADMIN_VIEWS`.
- **What the app must change:** Install `@ttt-productions/ttt-core@latest` wherever it is declared. `admin-sidebar.tsx` derives its full-admin list and each entry's `fullAdminOnly` from `FULL_ADMIN_ONLY_VIEWS`.
- **Done when:** The lockfiles name `@ttt-productions/ttt-core` 0.79.116 or later, no app module restates the list, and the gate is green.
