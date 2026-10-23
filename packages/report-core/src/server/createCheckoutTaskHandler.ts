import type {
  ServerFirestore,
  ServerReportCoreConfig,
  AdminAuthConfig,
  OnAuditEvent,
  ServerDocRef,
  TaskClaimGuard,
} from './types.js';
import { ReportCoreTaskError } from './taskError.js';
import { createCandidateCursor, MAX_CLAIM_ROUNDS } from './claimCandidates.js';
import type { CheckoutTaskRequest } from '../schemas/requests.js';
import type {
  AdminTaskStatus,
  CheckoutDetails,
  CheckoutTaskResult,
} from '../contracts/types-admin-task.js';
import { toClaimedTask } from './claimedTask.js';

export interface CheckoutTaskHandlerConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  auth?: AdminAuthConfig;
  onAuditEvent?: OnAuditEvent;
  assertTaskClaimable?: TaskClaimGuard;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

type ClaimOutcome =
  { kind: 'claimed'; result: CheckoutTaskResult } | { kind: 'contended' } | { kind: 'refused' };

export function createCheckoutTaskHandler({
  config,
  db,
  auth,
  onAuditEvent,
  assertTaskClaimable,
}: CheckoutTaskHandlerConfig) {
  const verifyAdmin = async (uid: string, authToken: unknown): Promise<void> => {
    if (!auth) return;
    if (auth.requireAdmin) {
      try {
        await auth.requireAdmin(uid, authToken);
        return;
      } catch {}
    }

    if (auth.adminUserIds?.includes(uid)) return;

    throw new ReportCoreTaskError('permission-denied', 'Administrator access required');
  };

  return async (
    data: CheckoutTaskRequest,
    authContext: { uid: string; token: unknown },
  ): Promise<CheckoutTaskResult> => {
    const { taskType, specificTaskId } = data;
    const userId = authContext.uid;

    await verifyAdmin(userId, authContext.token);

    const queueConfig = config.taskQueues[taskType];
    if (!queueConfig) {
      throw new ReportCoreTaskError('invalid-argument', 'Invalid task type specified.');
    }

    const claimTask = (
      taskRef: ServerDocRef,
      opts: { onConflict: 'throw' | 'skip' },
    ): Promise<ClaimOutcome> =>
      db.runTransaction(async (transaction): Promise<ClaimOutcome> => {
        const now = Date.now();

        // A Firestore transaction must make every read before its first write.
        const taskDoc = await transaction.get(taskRef);

        if (!taskDoc.exists) {
          if (opts.onConflict === 'skip') return { kind: 'contended' };
          throw new ReportCoreTaskError('not-found', 'The requested task could not be found.');
        }

        const taskData = taskDoc.data()!;
        const status = taskData.status;
        const lockExpiresAt = (taskData.checkoutDetails as Record<string, unknown> | undefined)
          ?.expiresAt as number | undefined;
        const lockActive =
          (status === 'checkedOut' || status === 'workLater') &&
          typeof lockExpiresAt === 'number' &&
          lockExpiresAt > now;
        const stealableExpired = (status === 'checkedOut' || status === 'workLater') && !lockActive;

        const checkoutHolder = (taskData.checkoutDetails as Record<string, unknown> | undefined)
          ?.userId;
        if (lockActive && checkoutHolder === userId && opts.onConflict === 'throw') {
          const originalDocRef = db.doc(taskData.originalPath as string);
          const originalDoc = await transaction.get(originalDocRef);
          const heldCheckout = taskData.checkoutDetails as CheckoutDetails;
          return {
            kind: 'claimed',
            result: {
              success: true,
              alreadyHeld: true,
              task: toClaimedTask(
                taskDoc.id,
                taskData,
                status as AdminTaskStatus,
                heldCheckout,
                originalDoc.exists ? originalDoc.data() : null,
              ),
            },
          };
        }

        if (status !== 'pending' && !stealableExpired) {
          if (opts.onConflict === 'skip') return { kind: 'contended' };
          if (lockActive) {
            throw new ReportCoreTaskError(
              'failed-precondition',
              'This task is already checked out by another admin.',
            );
          }
          throw new ReportCoreTaskError(
            'failed-precondition',
            'This task has already been resolved.',
          );
        }
        if (opts.onConflict === 'skip' && lockActive) {
          return { kind: 'contended' };
        }

        const originalDocRef = db.doc(taskData.originalPath as string);
        const originalDoc = await transaction.get(originalDocRef);

        if (assertTaskClaimable) {
          const verdict = await assertTaskClaimable({
            taskDocId: taskDoc.id,
            taskData,
            originalData: originalDoc.exists ? (originalDoc.data() ?? null) : null,
            transaction,
          });
          if (!verdict.claimable) {
            if (opts.onConflict === 'skip') return { kind: 'refused' };
            throw new ReportCoreTaskError('failed-precondition', verdict.message);
          }
        }

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
            task: toClaimedTask(
              taskDoc.id,
              taskData,
              'checkedOut',
              checkoutDetails,
              originalDoc.exists ? originalDoc.data() : null,
            ),
          },
        };
      });

    const tasksRef = db.collection(config.collections.adminTasks);

    if (specificTaskId) {
      const claim = await claimTask(tasksRef.doc(specificTaskId), { onConflict: 'throw' });
      return (claim as { kind: 'claimed'; result: CheckoutTaskResult }).result;
    }

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

    throw new ReportCoreTaskError(
      'aborted',
      'The task queue is busy right now — please try again.',
    );
  };
}
