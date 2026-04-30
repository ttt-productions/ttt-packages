# @ttt-productions/report-core

Content reporting and admin task queue pipeline. Users submit reports → reports are grouped → admin tasks are created with priority scoring → admins check out, review, and resolve tasks. Has both client-side React hooks/components and server-side Cloud Function handlers.

## Version
0.5.2

## Dependencies
Peer: @tanstack/react-query, @ttt-productions/query-core, @ttt-productions/ui-core, firebase, react, react-dom.

## What It Contains

### Client Entry Point (`index.ts`)

**Types (`types.ts`)**
- `Report` — Individual report: reporterUserId, reportedItemType/Id, reason, comment, status (pending_review/resolved_no_action/resolved_action_taken)
- `ReportGroup` — Grouped reports for the same item: groupKey, totalReports, highestReasonScore, status (pending/reviewing/resolved)
- `AdminTask` — Task in the admin queue: taskType, status (pending/checkedOut/workLater/completed), checkoutDetails, priority score, summary
- `CheckedOutTask` — AdminTask with guaranteed non-null checkoutDetails
- `CheckoutDetails` — Who checked it out, when, expiry time, workLater deadline
- `ReportableItemConfig`, `PriorityConfig`, `TaskQueueConfig` — App-provided configuration types

**Config (`config.ts`)**
- `ReportCoreConfig` — Full config: collections, reportableItems, reportReasons, priorityConfig, taskQueues, priorityThresholds
- `ReportCoreCollections` — Firestore collection path config (reports, reportGroups, adminTasks, activityLog)
- `DEFAULT_PRIORITY_THRESHOLDS` — CRITICAL (800+), HIGH (300+), NORMAL (100+), LOW (0+)
- `ADMIN_TASK_STATUS` — Status constants

**Context (`context/`)**
- `ReportCoreProvider` — Provides ReportCoreConfig to all hooks/components via context

**Hooks (`hooks/`)**
User-facing:
- `useReportSubmit(config)` — Submit a content report
- `useCheckExistingReport(config)` — Check if user already reported an item

Admin-facing:
- `useTaskQueue(config)` — Browse the admin task queue
- `useCheckedOutTasks(config)` — View tasks currently checked out by the admin
- `useCheckoutTask(config)` — Check out a task for review
- `useCheckinTask(config)` — Complete/resolve a checked-out task
- `useReleaseTask(config)` — Release a task back to the queue
- `useWorkLater(config)` — Defer a task for later review
- `useIndividualReports(config)` — View individual reports for a grouped item

**Components (`components/`)**
User-facing:
- `ReportButton` + `useReportButton()` — Report trigger button with existing-report detection
- `ReportDialog` — Modal dialog for submitting a report (reason selection + comment)

Admin-facing:
- `TaskQueueBrowser` — Browse and filter the admin task queue
- `CheckedOutTaskList` — View and manage checked-out tasks
- `TaskActionBar` — Action buttons for task operations (resolve, release, work later)
- `CountdownTimer` — Checkout expiry countdown
- `PriorityBadge` — Visual priority indicator (CRITICAL/HIGH/NORMAL/LOW)

### Server Entry Point (`server/index.ts`)
Cloud Function handler factories:
- `createReportGroupingHandler(config)` — Groups incoming reports by item, calculates priority scores
- `createAdminTaskHandler(config)` — Creates admin tasks from report groups
- `createCheckoutTaskHandler(config)` — Handles task checkout with expiry
- `createCheckinTaskHandler(config)` — Handles task completion/resolution
- `createReleaseTaskHandler(config)` — Releases tasks back to queue
- `createCheckoutNextImportantHandler(config)` — Auto-checkout the highest-priority pending task
- `calculatePriorityScore(reports, config)` — Priority scoring algorithm
- `recalculateAllPriorities(config)` — Bulk recalculate all task priorities

Server types: `ServerFirestore`, `ServerReportCoreConfig`, etc.

## Pipeline Flow
1. User submits report via `useReportSubmit` → writes to reports collection
2. Cloud Function groups reports by item → writes/updates report group
3. Cloud Function creates admin task from group → writes to admin tasks with priority score
4. Admin browses task queue → checks out a task (with expiry timer)
5. Admin reviews → resolves (action taken / no action) or releases back to queue
6. Resolution logged to activity log

## Key Design Decisions
- Identity display fields are intentionally not part of the report/admin-task payload. Consuming apps store user ids and resolve display names/avatars from their identity source at render time.
- Config-driven: consuming apps define reportable item types, reasons, priority weights, and collection paths.
- Priority scoring is automatic based on report count, reason severity, and recency.
- Checkout has an expiry timer to prevent tasks from being locked indefinitely.
- "Work Later" allows admins to defer without releasing — maintains assignment but extends the deadline.
- All server handlers are factory functions that accept config — no hardcoded collection paths.

## Files
```
src/
  index.ts, types.ts, config.ts
  context/ReportCoreProvider.tsx
  hooks/
    index.ts
    useReportSubmit.ts, useCheckExistingReport.ts
    useTaskQueue.ts, useCheckedOutTasks.ts
    useCheckoutTask.ts, useCheckinTask.ts
    useReleaseTask.ts, useWorkLater.ts
    useIndividualReports.ts
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
```
