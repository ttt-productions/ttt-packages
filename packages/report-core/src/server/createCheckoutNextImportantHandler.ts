import type {
  ServerFirestore,
  ServerReportCoreConfig,
  AdminAuthConfig,
  OnAuditEvent,
  TaskClaimGuard,
} from './types.js';
import { ReportCoreTaskError } from './taskError.js';
import { verifyAdminAccess } from './verifyAdminAccess.js';
import { createCandidateCursor, MAX_CLAIM_ROUNDS } from './claimCandidates.js';
import type { CheckoutNextImportantTaskResult } from '../contracts/types-admin-task.js';
import { toClaimedTask } from './claimedTask.js';

export interface CheckoutNextImportantHandlerConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  auth?: AdminAuthConfig;
  onAuditEvent?: OnAuditEvent;
  assertTaskClaimable?: TaskClaimGuard;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

type ClaimOutcome =
  | { kind: 'claimed'; result: CheckoutNextImportantTaskResult }
  | { kind: 'contended' }
  | { kind: 'refused' };

export function createCheckoutNextImportantHandler({
  config,
  db,
  auth,
  onAuditEvent,
  assertTaskClaimable,
}: CheckoutNextImportantHandlerConfig) {
  return async (
    _data: unknown,
    authContext: { uid: string; token: unknown },
  ): Promise<CheckoutNextImportantTaskResult> => {
    const userId = authContext.uid;
    await verifyAdminAccess(auth, userId, authContext.token);

    const pending = createCandidateCursor(() =>
      db
        .collection(config.collections.adminTasks)
        .where('status', '==', 'pending')
        .orderBy('priority', 'desc')
        .orderBy('createdAt', 'asc'),
    );

    let contendedRounds = 0;
    while (contendedRounds < MAX_CLAIM_ROUNDS) {
      const candidate = await pending.next();
      if (!candidate) {
        throw new ReportCoreTaskError('not-found', 'No pending tasks available! All caught up! 🎉');
      }
      const candidateRef = candidate.ref;

      const claim = await db.runTransaction(async (transaction): Promise<ClaimOutcome> => {
        const now = Date.now();

        // A Firestore transaction must make every read before its first write.
        const taskDoc = await transaction.get(candidateRef);
        if (!taskDoc.exists) return { kind: 'contended' };
        const taskData = taskDoc.data()!;
        if (taskData.status !== 'pending') return { kind: 'contended' };

        const originalDocRef = db.doc(taskData.originalPath as string);
        const originalDoc = await transaction.get(originalDocRef);

        if (assertTaskClaimable) {
          const verdict = await assertTaskClaimable({
            taskDocId: taskDoc.id,
            taskData,
            originalData: originalDoc.exists ? (originalDoc.data() ?? null) : null,
            transaction,
          });
          if (!verdict.claimable) return { kind: 'refused' };
        }

        const taskType = taskData.taskType as string;
        const queueConfig = config.taskQueues[taskType];
        const checkoutMinutes = queueConfig?.defaultCheckoutMinutes ?? 60;
        const expiresAt = now + checkoutMinutes * 60 * 1000;

        const checkoutDetails = {
          userId,
          checkedOutAt: now,
          expiresAt,
          workLaterUntil: null,
        };

        transaction.update(candidateRef, {
          status: 'checkedOut',
          checkoutDetails,
        });

        if (onAuditEvent) {
          await onAuditEvent(
            {
              action: 'checkout_next_important',
              adminUserId: userId,
              taskType,
              taskId: taskData.taskId as string,
              priority: taskData.priority as number,
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

      if (claim.kind === 'claimed') return claim.result;
      if (claim.kind === 'refused') pending.skip(candidate);
      else contendedRounds++;
    }

    throw new ReportCoreTaskError(
      'aborted',
      'The task queue is busy right now — please try again.',
    );
  };
}
