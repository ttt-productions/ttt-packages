# @ttt-productions/report-core

Content reporting and admin task queue pipeline. Users submit reports → reports are grouped → admin tasks are created with priority scoring → admins check out, review, and resolve tasks. Has server-safe types/config, client-side React hooks/components, and server-side Cloud Function handlers.

## Version
0.5.4

## Dependencies
Peer: @tanstack/react-query, @ttt-productions/query-core, @ttt-productions/ttt-core, @ttt-productions/ui-core, firebase, react, react-dom.

## Entry Points

- `@ttt-productions/report-core` — server-safe types, config types, `DEFAULT_PRIORITY_THRESHOLDS`, and `ADMIN_TASK_STATUS`.
- `@ttt-productions/report-core/react` — React provider, hooks, and components.
- `@ttt-productions/report-core/server` — Cloud Function handler factories and server types.
- `@ttt-productions/report-core/styles` — CSS side-effect import.

## What It Contains

### Server-safe main entry (`index.ts`)
Types and config:
- `Report`, `ReportStatus`, `ReportGroup`, `ReportGroupStatus`
- `AdminTask`, `AdminTaskStatus`, `CheckoutDetails`, `CheckedOutTask`
- `ActivityAction`, `ActivityLogEntry`
- `TaskQueueConfig`, `ReportableItemConfig`, `PriorityConfig`
- Component prop types
- `ReportCoreConfig`, `ReportCoreCollections`, `PriorityThreshold`
- `DEFAULT_PRIORITY_THRESHOLDS`, `ADMIN_TASK_STATUS`

### React entry point (`react/index.ts`)
Context:
- `ReportCoreProvider`, `useReportCoreContext`

Hooks:
- `useReportSubmit(config)` — Submit a content report
- `useCheckedOutTasks(config)` — View tasks currently checked out by the admin
- `useCheckoutTask(config)` — Check out a task for review
- `useCheckinTask(config)` — Complete/resolve a checked-out task
- `useReleaseTask(config)` — Release a task back to the queue
- `useWorkLater(config)` — Defer a task for later review
- `useTaskQueue(config)` — Browse the admin task queue
- `useIndividualReports(config)` — View individual reports for a grouped item
- `useCheckoutNextImportantTask(config)` — Check out the highest-priority pending task

Components:
- `ReportButton` + `useReportButton()` — Report trigger button with existing-report detection
- `ReportDialog` — Modal dialog for submitting a report
- `CheckedOutTaskList`, `TaskQueueBrowser`, `CountdownTimer`, `PriorityBadge`, `TaskActionBar`

### Server entry point (`server/index.ts`)
Cloud Function handler factories:
- `createReportGroupingHandler(config)` — Groups incoming reports by item, calculates priority scores
- `createAdminTaskHandler(config)` — Creates admin tasks from report groups
- `createCheckoutTaskHandler(config)` — Handles task checkout with expiry
- `createCheckinTaskHandler(config)` — Handles task completion/resolution
- `createReleaseTaskHandler(config)` — Releases tasks back to queue
- `createCheckoutNextImportantHandler(config)` — Auto-checkout the highest-priority pending task
- `calculatePriorityScore(reports, config)` — Priority scoring algorithm
- `recalculateAllPriorities(config)` — Bulk recalculate all task priorities

Server types: `ServerFirestore`, `ServerReportCoreConfig`, `ReportCoreAuditEvent`, `OnAuditEvent`, etc.

Admin task handler factories accept an optional `onAuditEvent` callback. The callback receives a `ReportCoreAuditEvent` discriminated-union payload plus the active transaction, so consuming apps can map package activity-log actions into their own audit-event system atomically.

## Pipeline Flow
1. User submits report via `useReportSubmit` → writes to reports collection
2. Cloud Function groups reports by item → writes/updates report group
3. Cloud Function creates admin task from group → writes to admin tasks with priority score
4. Admin browses task queue → checks out a task (with expiry timer)
5. Admin reviews → resolves (action taken / no action) or releases back to queue
6. Resolution logged to activity log
7. If `onAuditEvent` is supplied, consumer writes its own audit event inside the same transaction

## Key Design Decisions
- Identity display fields are intentionally not part of the report/admin-task payload. Consuming apps store user ids and resolve display names/avatars from their identity source at render time.
- Config-driven: consuming apps define reportable item types, reasons, priority weights, and collection paths.
- Priority scoring is automatic based on report count, reason severity, and recency.
- Checkout has an expiry timer to prevent tasks from being locked indefinitely.
- "Work Later" allows admins to defer without releasing — maintains assignment but extends the deadline.
- All server handlers are factory functions that accept config — no hardcoded collection paths.
- Admin task handlers expose `onAuditEvent` rather than importing an app-specific audit package, preserving package/app layering while enabling atomic audit-event parallel writes.
- Main is server-safe types/config only; React runtime surface lives on `/react`; Cloud Function helpers live on `/server`.

## Files
```
src/
  index.ts, types.ts, config.ts
  react/
    index.ts
  context/
    ReportCoreProvider.tsx
  hooks/
    index.ts
    useReportSubmit.ts, useCheckedOutTasks.ts
    useCheckoutTask.ts, useCheckinTask.ts
    useReleaseTask.ts, useWorkLater.ts
    useTaskQueue.ts, useIndividualReports.ts
    useCheckoutNextImportantTask.ts
  components/
    index.ts
    ReportButton.tsx, ReportDialog.tsx
    TaskQueueBrowser.tsx, CheckedOutTaskList.tsx
    TaskActionBar.tsx, CountdownTimer.tsx, PriorityBadge.tsx
  server/
    index.ts, types.ts
    createReportGroupingHandler.ts, createAdminTaskHandler.ts
    createCheckoutTaskHandler.ts, createCheckinTaskHandler.ts
    createReleaseTaskHandler.ts, createCheckoutNextImportantHandler.ts
    calculatePriorityScore.ts, recalculateAllPriorities.ts
  styles/
    report.css
```
