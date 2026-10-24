# Adopt @ttt-productions/report-core 0.16.24

**What:** The admin task's summary is the app's wording; a failed admin lookup is no longer read as "not an admin".
**Severity:** high
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/report-core` 0.16.24.
- **Release:** `./scripts/release-multiple.sh audit-core auth-core chat-react chat-schemas consent-core dev-standards edge-protocol-core file-input firebase-helpers media-processing-core media-schemas media-viewer mobile-core moderation-core monitoring-core notification-core query-core rate-limit-core realtime-core repo-guards report-core ttt-core ui-core upload-core upload-ui patch`.
- **What changed:**
  - `ServerReportCoreConfig` takes a required `describeUserReportTask({ totalReports, reportedItemType })`, which writes a user-report task's `summary`. The package no longer writes `"N report(s) for <item-type id>"` itself.
  - `createCheckoutTaskHandler` / `createCheckoutNextImportantHandler`: only a `requireAdmin` refusal whose `code` is `permission-denied` falls through to `adminUserIds`; any other failure of the admin lookup fails the call as itself (before, every failure was swallowed and the caller read as "not an admin").
  - `createAdminTaskHandler`'s handler accepts `null` / `undefined` group data (it already returned on it).
- **What the app must change:** Install. Give the app's server report config a `describeUserReportTask` worded from its own item labels, and assert the admin row's wording in its admin tests. Make sure the app's `requireAdmin` refuses with a `permission-denied` code.
- **Done when:** The lockfiles name `@ttt-productions/report-core` 0.16.24 or later, and the gate is green.
