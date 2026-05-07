import type { ServerFirestore, ServerReportCoreConfig, OnAuditEvent } from './types.js';
import type { CreateContentReportRequest } from '../schemas/index.js';

export interface CreateContentReportHandlerConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
  onAuditEvent?: OnAuditEvent;
}

/**
 * Factory that returns the handler for the createContentReport callable function.
 * Writes the report doc transactionally and throws ALREADY_REPORTED if a report
 * from the same user on the same item already exists.
 */
export function createContentReportHandler({
  config,
  db,
  onAuditEvent,
}: CreateContentReportHandlerConfig) {
  return async (
    data: CreateContentReportRequest,
    authContext: { uid: string; token?: unknown },
  ): Promise<{ success: boolean; reportId: string }> => {
    const reportId = `${authContext.uid}_${data.reportedItemId}`;
    const now = Date.now();

    return db.runTransaction(async (transaction) => {
      const reportRef = db.collection(config.collections.reports).doc(reportId);
      const existing = await transaction.get(reportRef);

      if (existing.exists) {
        throw new Error('ALREADY_REPORTED');
      }

      const reportData: Record<string, unknown> = {
        reportId,
        reporterUserId: authContext.uid,
        reportedItemType: data.reportedItemType,
        reportedItemId: data.reportedItemId,
        ...(data.parentItemId ? { parentItemId: data.parentItemId } : {}),
        ...(data.reportedUserId ? { reportedUserId: data.reportedUserId } : {}),
        reason: data.reason,
        comment: data.comment.trim(),
        createdAt: now,
        status: 'pending_review',
      };

      transaction.set(reportRef, reportData);

      if (onAuditEvent) {
        await onAuditEvent(
          {
            action: 'report_created',
            reporterUserId: authContext.uid,
            reportedItemType: data.reportedItemType,
            reportedItemId: data.reportedItemId,
            reason: data.reason,
            reportId,
            timestamp: now,
          },
          transaction,
        );
      }

      return { success: true, reportId };
    });
  };
}
