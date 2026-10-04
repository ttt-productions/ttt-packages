# @ttt-productions/report-core

Generic report-filing UI and admin-task queue package.

## Owns

- The `submitReport` wire contract (`createSubmitReportRequestSchema` / `SubmitReportResult`) consumed by the
  app's `submitReport` callable. Report data itself has no canonical stored shape here; the app owns the
  Firestore report document and report-group shape.
- The report-filing dialog (`ReportDialog`, `ReportButton`, `useReportButton`) and its contract types.
- Generic admin task, checkout, activity, status, and priority shapes, and the queue handler factories.
- Type-level generics for the consuming app's task-type union.

## Entry points

- `.` — broad barrel: types, config, constants (server-safe). The report-dialog contract types
  (`ReportTargetRef`, `AdditionalReportAction`, `ReportDialogCopy`, `ReportDialogSuccess`,
  `ReportDialogProps`, `ReportButtonProps`, `UseReportButtonOptions`, `UseReportButtonResult`) are
  type-only here, so importing them pulls in no React.
- `./contracts` — pure, dependency-light surface: `AdminTask` and `ADMIN_TASK_STATUS` (admin-task
  status — there is no `Report` type or report-status constant in this package), plus the pure Zod
  wire schemas. No React, no server, no Admin SDK reachable from it. **Pure consumers (`ttt-core`,
  Cloud Functions) import from `./contracts`** instead of the broad root.
- `./react` — `ReportCoreProvider` / `useReportCoreContext`, the report dialog, the queue hooks, and
  `CountdownTimer` / `PriorityBadge`.
- `./server` — the queue handler factories.
- `./schemas` — wire-format Zod schemas. A free-text field in them is never bounded here: `createCheckinTaskRequestSchema({ resolution })`
  and `createSubmitReportRequestSchema({ comment })` take the consuming app's own field schema
  (`ReportTextFieldSchema`, `z.ZodType<string | undefined>` — built by the app over its declaration, so its
  format, bounds, trim, and optionality are the app's; ARCH-201, ARCH-102). The opaque ids, item type, and
  reason keep their structural bounds. `CheckinTaskRequest` and `SubmitReportRequest` are the shapes with
  that text optional, which the check-in handler and the dialog's submit hook read and send.
- `./styles` — admin/report CSS. It reads theme-core's semantic tokens (`hsl(var(--card))`,
  `--destructive`, `--warning`, …) and carries no raw colour; its keyframes are namespaced (`rc-pulse`).

## The report dialog (`./react`)

`ReportDialog` is the report-filing UI; `ReportButton` is a flag trigger that renders it for one item;
`useReportButton` is the open state behind a custom trigger or a target chosen at click time. The
package carries no product copy and no product routing:

- **Every string is the app's.** `copy: ReportDialogCopy` supplies the titles, labels, placeholders,
  and button text of all three views; the two descriptions are functions of the item's display name
  (`config.reportableItems[itemType].displayName`, else the type id) and, for the upgrade, the reason.
  `ReportButton` takes its trigger's accessible name as `triggerLabel` and renders a neutral `ghost`
  trigger by default (red belongs only to a dialog's confirm — FRONTEND-006).
- **Every outcome is handled, on the first submit and on the upgrade confirm alike.** `filed` and
  `upgraded` close the dialog and reach `onSubmitSuccess(result)`; `alreadyReported` shows the
  already-reported view; `upgradeAvailable` shows the upgrade view, whose confirm re-calls the callable
  with `confirmUpgrade: true`. A refusal or an offered upgrade is never reported to the app as success.
- **Additional actions** (`ReportCoreProvider`'s `additionalReportActions`, already filtered for who
  may see them) join the reason picker. A `submit` action runs its handler with the comment instead of
  the callable and is reported as `{ outcome: 'actionCompleted', actionId }`. A `handOff` action sends
  the reporter to another surface: the comment field is hidden and never required or passed — nothing
  the reporter typed can ride along — its handler resolves once the destination has rendered, and the
  dialog then closes without reporting a submission.
- **Comments.** The comment's field declaration is the app's — `config.reportCommentInput`, an
  `input-format-core` `DeclaredInputFormat` made by `defineInputFormat` (format, min, max). Its `Textarea` takes the declaration (so
  the field is capped at its `max`), and a report reason or a `submit` action can be sent only when
  `checkInputFormat` passes the comment: with `min: 1` it cannot be blank, with `min: 0` it may be
  empty. What is sent — to the callable and to a `submit` action's handler — is the checked value,
  trimmed, exactly what the server keeps. Its `{length}/{max}` counter is wired to the field with
  `aria-describedby`.
- **Unsent comment.** Closing the form or upgrade view — Cancel, Escape, an outside click — while
  the draft holds a non-blank comment asks first through ui-core's `ConsequenceDialog`
  (FRONTEND-207), worded by `copy.discardTitle` / `discardDescription` / `discardConfirmLabel` /
  `discardKeepLabel`: confirming drops the draft and closes, keeping leaves the dialog open with the
  comment. A picked reason alone is not unsaved input, and the already-reported view (the callable
  has answered) closes without asking.
- **Pending and failure.** Each submit shows pending on its own button, repeats are ignored, and the
  dialog cannot be dismissed while one runs. Every failure — a cancelled hand-off (`AbortError`)
  included — goes to the required `onSubmitError` and leaves the dialog open; the app decides what to
  surface. Nothing is submitted without a `reporterUserId`.
- **Bound to the reporter.** The dialog's draft (reason, comment, view) and `useReportButton`'s open
  state belong to the reporter who created them: a different signed-in reporter reads them empty and
  closed (FRONTEND-108). With no reporter, `openReport` calls `onSignInRequired` and opens nothing.

## The admin-task queue handlers (`./server`)

Factories for the consuming app's queue callables. `createCheckoutTaskHandler`,
`createCheckoutNextImportantHandler`, `createCheckinTaskHandler`, and `createReleaseTaskHandler` each
read and write the task in one transaction and call the app's optional `onAuditEvent(event,
transaction)` inside it; `createAdminTaskHandler` is the standalone task-creation write over
`buildUserReportAdminTaskDoc`. Expected refusals throw `ReportCoreTaskError`, whose `code` is the
matching `HttpsError` code.

- **Check-in honours the resolution owner.** `createCheckinTaskHandler` requires
  `isResolvedByCheckin(taskType)` and `domainResolutionRefusalMessage`. A `resolved: true` check-in
  of a held task whose stored type answers `false` — its resolution belongs to a domain resolver that
  writes the decision and deletes the task — is refused `failed-precondition` with the app's message
  before any write or audit. Checking a task back in unresolved is always allowed, and a task that is
  already gone answers `{ success: true, alreadyResolved: true }` and writes nothing.
- **Takeover attribution.** Checking out a task whose checkout has expired emits `auto_released`
  with the admin taking it over as `adminUserId` (the actor) and the holder whose lock expired as
  `priorAdminUserId`, then the `checkout` event. The next-important checkout takes only pending tasks,
  so it never takes one over.
- **Re-checking out your own lock.** A specific-task checkout of a task the caller already holds
  under a live lock answers `{ success: true, alreadyHeld: true, task }` with the lock as it stands,
  and writes nothing (no extension, no audit). Another admin's live lock is refused.
- **The app's claim guard.** `createCheckoutTaskHandler` and `createCheckoutNextImportantHandler`
  take an optional `assertTaskClaimable: TaskClaimGuard` — the app's check that a task may be
  claimed right now (for TTT, that its report group is not owned by an automated action or already
  resolved). It runs inside the claim transaction, after the status guard and the reads of the task
  and its `originalPath` document, and before any write or audit: it receives `{ taskDocId,
  taskData, originalData, transaction }` (`originalData` is `null` when that document is gone), may
  read more through `transaction`, and answers `{ claimable: true }` or `{ claimable: false,
  message }`. A refused specific-task checkout throws `failed-precondition` with the app's
  `message`; a refused queue candidate (pending or expired) is skipped and the queue's cursor moves
  past it (`startAfter` the refused task, one one-document read per refusal — never a re-read from
  the head), a refusal does not use one of the contention rounds, and a queue with no unrefused
  candidate left answers the ordinary empty-queue `not-found`. `ServerQuery` therefore includes
  `startAfter(snapshot)`, which the Admin SDK's `Query` provides. The guard is never asked
  for the already-held answer, and a guard that throws aborts the claim (a failed check is never
  "claimable").

## Boundary

The consuming app owns the concrete `AdminTaskType` union, which task types a domain resolver owns,
every string the dialog shows, the report comment's declaration, and any app-specific report routing
(e.g. TTT's protected-category hand-off). `report-core` does not import `ttt-core`; its one internal
runtime dependency is `input-format-core`, whose check judges the comment.
