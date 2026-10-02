import type {
  ServerFirestore,
  ServerReportCoreConfig,
  AdminAuthConfig,
  OnAuditEvent,
  ServerDocRef,
  TaskClaimGuard,
} from './types.js';
import { ReportCoreTaskError } from './taskError.js';
import { createCandidateCursor } from './claimCandidates.js';
import type { CheckoutTaskRequest } from '../schemas/index.js';

export interface CheckoutTaskHandlerConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  auth: AdminAuthConfig;
  onAuditEvent?: OnAuditEvent;
  /** The app's in-transaction check that a task may be claimed now (see `TaskClaimGuard`). */
  assertTaskClaimable?: TaskClaimGuard;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

type ClaimOutcome =
  | { kind: 'claimed'; result: Record<string, unknown> }
  | { kind: 'contended' }
  | { kind: 'refused' };

/**
 * Query→claim rounds attempted before reporting contention. Candidate discovery runs
 * OUTSIDE the transaction: a range query inside it takes a range lock over the whole
 * pending queue, so every concurrent status flip (any checkout or release) becomes a
 * transaction conflict and all admin queue mutations serialize. Each round re-queries,
 * then claims the specific candidate doc with an in-transaction status re-check —
 * doc-level conflicts only. A candidate the claim guard refuses does not use a round: the
 * queue's cursor moves past it, so each refusal costs one one-document read.
 */
const MAX_CLAIM_ROUNDS = 5;

/**
 * Factory that returns the handler for the checkoutTask callable function.
 *
 * Behavior:
 * 1. Verifies admin auth (requireAdmin function or adminUserIds fallback)
 * 2. If specificTaskId provided, checks out that task
 * 3. Otherwise finds the highest-priority pending task of the given type
 * 4. Falls back to expired checked-out tasks
 * 5. Asks the app's claim guard, inside the claim transaction, whether the task may be
 *    claimed — a refused specific task is answered `failed-precondition` with the app's
 *    message; a refused queue candidate is skipped for the next one
 * 6. Sets checkout details with expiration
 * 7. Logs activity
 *
 * @returns An async handler: (data, authContext) => Promise<result>
 */
export function createCheckoutTaskHandler({
  config,
  db,
  auth,
  onAuditEvent,
  assertTaskClaimable,
}: CheckoutTaskHandlerConfig) {
  const verifyAdmin = async (uid: string, authToken: unknown): Promise<void> => {
    // Try requireAdmin first
    if (auth.requireAdmin) {
      try {
        await auth.requireAdmin(uid, authToken);
        return;
      } catch {
        // Fall through to adminUserIds check
      }
    }

    // Fallback to hardcoded list
    if (auth.adminUserIds?.includes(uid)) return;

    throw new ReportCoreTaskError('permission-denied', 'Administrator access required');
  };

  return async (
    data: CheckoutTaskRequest,
    authContext: { uid: string; token: unknown },
  ): Promise<Record<string, unknown>> => {
    const { taskType, specificTaskId } = data;
    const userId = authContext.uid;

    await verifyAdmin(userId, authContext.token);

    const queueConfig = config.taskQueues[taskType];
    if (!queueConfig) {
      throw new ReportCoreTaskError('invalid-argument', 'Invalid task type specified.');
    }

    /**
     * Claim ONE specific task doc in a doc-level transaction, re-checking its status
     * inside the transaction. `onConflict: 'throw'` (the specificTaskId path) surfaces
     * the precise rejection to the caller; `onConflict: 'skip'` (the queue path)
     * answers `contended` or `refused` so the caller re-queries for the next candidate.
     */
    const claimTask = (
      taskRef: ServerDocRef,
      opts: { onConflict: 'throw' | 'skip' },
    ): Promise<ClaimOutcome> =>
      db.runTransaction(async (transaction): Promise<ClaimOutcome> => {
        const now = Date.now();

        // ── READS (all reads must happen before any writes in a Firestore transaction) ──
        const taskDoc = await transaction.get(taskRef);

        if (!taskDoc.exists) {
          if (opts.onConflict === 'skip') return { kind: 'contended' };
          throw new ReportCoreTaskError('not-found', 'The requested task could not be found.');
        }

        const taskData = taskDoc.data()!;
        // Status guard: only a `pending` task, or a `checkedOut`/`workLater` task whose
        // lock has EXPIRED (the legitimate steal), may be checked out here. A `completed`
        // (resolved) task — or any other status — must be rejected, otherwise a stale
        // preview lets an admin re-check-out and re-work an already-resolved task
        // (re-applying its actions on the underlying group / racing another admin's close).
        const status = taskData.status;
        const lockExpiresAt = (taskData.checkoutDetails as Record<string, unknown> | undefined)?.expiresAt as
          | number
          | undefined;
        const lockActive =
          (status === 'checkedOut' || status === 'workLater') &&
          typeof lockExpiresAt === 'number' &&
          lockExpiresAt > now;
        const stealableExpired =
          (status === 'checkedOut' || status === 'workLater') && !lockActive;

        const checkoutHolder = (taskData.checkoutDetails as Record<string, unknown> | undefined)?.userId;
        if (lockActive && checkoutHolder === userId && opts.onConflict === 'throw') {
          // The caller already holds this task under a live lock: answer that truthfully with
          // the task as held, and change nothing — no lock extension, no audit event.
          const originalDocRef = db.doc(taskData.originalPath as string);
          const originalDoc = await transaction.get(originalDocRef);
          const heldCheckout = taskData.checkoutDetails as Record<string, unknown>;
          return {
            kind: 'claimed',
            result: {
              success: true,
              alreadyHeld: true,
              task: {
                id: taskDoc.id,
                taskType: taskData.taskType,
                taskId: taskData.taskId,
                originalPath: taskData.originalPath,
                summary: taskData.summary,
                priority: taskData.priority,
                checkedOutAt: heldCheckout.checkedOutAt,
                expiresAt: heldCheckout.expiresAt,
                status,
                checkoutDetails: heldCheckout,
                itemData: originalDoc.exists ? originalDoc.data() : null,
              },
            },
          };
        }

        if (status !== 'pending' && !stealableExpired) {
          if (opts.onConflict === 'skip') return { kind: 'contended' };
          if (lockActive) {
            throw new ReportCoreTaskError('failed-precondition', 'This task is already checked out by another admin.');
          }
          // completed / resolved / unknown terminal — nothing to check out.
          throw new ReportCoreTaskError('failed-precondition', 'This task has already been resolved.');
        }
        if (opts.onConflict === 'skip' && lockActive) {
          // Queue candidate stolen between the query and this transaction.
          return { kind: 'contended' };
        }

        // Fetch original document (must read before any writes in the transaction)
        const originalDocRef = db.doc(taskData.originalPath as string);
        const originalDoc = await transaction.get(originalDocRef);

        // The app's claim guard: the last of the reads, before the first write (the audit
        // hook below writes).
        if (assertTaskClaimable) {
          const verdict = await assertTaskClaimable({
            taskDocId: taskDoc.id,
            taskData,
            originalData: originalDoc.exists ? originalDoc.data() ?? null : null,
            transaction,
          });
          if (!verdict.claimable) {
            if (opts.onConflict === 'skip') return { kind: 'refused' };
            throw new ReportCoreTaskError('failed-precondition', verdict.message);
          }
        }

        // Audit the auto-release of a previous (expired) checkout. The caller taking it over is
        // the actor; the holder whose lock expired is the subject.
        if (taskData.checkoutDetails) {
          const prevCheckout = taskData.checkoutDetails as Record<string, unknown>;
          if (onAuditEvent) {
            await onAuditEvent(
              {
                action: 'auto_released',
                adminUserId: userId,
                priorAdminUserId: prevCheckout.userId as string,
                taskType: taskData.taskType as string,
                taskId: taskData.taskId as string,
                timestamp: now,
              },
              transaction,
            );
          }
        }

        const expiresAt = now + queueConfig.defaultCheckoutMinutes * 60 * 1000;
        const checkoutDetails = {
          userId,
          checkedOutAt: now,
          expiresAt,
          workLaterUntil: null,
        };

        // ── WRITES (no more reads after this point) ──
        transaction.update(taskRef, {
          status: 'checkedOut',
          checkoutDetails,
        });

        if (onAuditEvent) {
          await onAuditEvent(
            {
              action: 'checkout',
              adminUserId: userId,
              taskType: taskData.taskType as string,
              taskId: taskData.taskId as string,
              timestamp: now,
            },
            transaction,
          );
        }

        return {
          kind: 'claimed',
          result: {
            success: true,
            task: {
              id: taskDoc.id,
              taskType: taskData.taskType,
              taskId: taskData.taskId,
              originalPath: taskData.originalPath,
              summary: taskData.summary,
              priority: taskData.priority,
              checkedOutAt: now,
              expiresAt,
              status: 'checkedOut',
              checkoutDetails,
              itemData: originalDoc.exists ? originalDoc.data() : null,
            },
          },
        };
      });

    const tasksRef = db.collection(config.collections.adminTasks);

    if (specificTaskId) {
      // Doc-level transaction on the named task; the status guard and the claim guard throw
      // the precise error, so this path only ever answers `claimed`.
      const claim = await claimTask(tasksRef.doc(specificTaskId), { onConflict: 'throw' });
      return (claim as { kind: 'claimed'; result: Record<string, unknown> }).result;
    }

    // Candidate discovery — OUTSIDE the transaction (see MAX_CLAIM_ROUNDS): the
    // highest-priority pending task, else the longest-expired checked-out one.
    const pending = createCandidateCursor(() =>
      tasksRef
        .where('taskType', '==', taskType)
        .where('status', '==', 'pending')
        .orderBy('priority', 'desc')
        .orderBy('createdAt', 'asc'),
    );
    const expired = createCandidateCursor(() =>
      tasksRef
        .where('taskType', '==', taskType)
        .where('status', '==', 'checkedOut')
        .where('checkoutDetails.expiresAt', '<', Date.now())
        .orderBy('checkoutDetails.expiresAt', 'asc'),
    );

    let contendedRounds = 0;
    while (contendedRounds < MAX_CLAIM_ROUNDS) {
      let cursor = pending;
      let candidate = await pending.next();
      if (!candidate) {
        cursor = expired;
        candidate = await expired.next();
      }

      if (!candidate) {
        throw new ReportCoreTaskError('not-found', 'No available tasks in this queue.');
      }

      const claim = await claimTask(candidate.ref, { onConflict: 'skip' });
      if (claim.kind === 'claimed') return claim.result;
      if (claim.kind === 'refused') cursor.skip(candidate);
      else contendedRounds++;
    }

    throw new ReportCoreTaskError('aborted', 'The task queue is busy right now — please try again.');
  };
}
