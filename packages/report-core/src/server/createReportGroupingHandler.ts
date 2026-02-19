import type {
  ServerFirestore,
  ServerFieldValue,
  ServerReportCoreConfig,
} from './types.js';

export interface ReportGroupingHandlerConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  /** firebase-admin FieldValue — passed in so we don't import firebase-admin */
  fieldValue: ServerFieldValue;
  /**
   * Sync function that determines the grouping key for a report.
   * Return the doc ID to use in the reportGroups collection.
   */
  groupingStrategy: (report: Record<string, unknown>) => string;
  /** Optional logger. Defaults to console. */
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

/**
 * Factory that returns the handler logic for when a new report is created.
 * The app registers this as an onDocumentCreated trigger.
 *
 * What it does:
 * 1. Reads the new report data
 * 2. Determines the group key via groupingStrategy
 * 3. Creates or updates the report group (increment count, update lastReportAt)
 * 4. Stores the highest reason score on the group for priority calculation
 *
 * @returns An async handler function: (reportData: Record<string, unknown>, reportId: string) => Promise<void>
 */
export function createReportGroupingHandler({
  config,
  db,
  fieldValue,
  groupingStrategy,
  logger = console,
}: ReportGroupingHandlerConfig) {
  return async (reportData: Record<string, unknown>, reportId: string): Promise<void> => {
    if (!reportData) {
      logger.error('No data in report creation event');
      return;
    }

    const groupDocId = groupingStrategy(reportData);
    if (!groupDocId) {
      logger.error(`Could not determine group key for report ${reportId}`);
      return;
    }

    const now = Date.now();
    const reason = reportData.reason as string;
    const reasonScore =
      config.priorityConfig.reasonScores[reason] ??
      config.priorityConfig.defaultReasonScore;

    const groupRef = db.collection(config.collections.reportGroups).doc(groupDocId);

    await db.runTransaction(async (transaction) => {
      const groupDoc = await transaction.get(groupRef);

      if (!groupDoc.exists) {
        // First report for this item — create group
        transaction.set(groupRef, {
          groupKey: groupDocId,
          reportedItemId: reportData.reportedItemId as string,
          reportedItemType: reportData.reportedItemType as string,
          reportedUserId: (reportData.reportedUserId as string) || null,
          reportedUsername: (reportData.reportedUsername as string) || null,
          lastReportAt: now,
          totalReports: 1,
          highestReasonScore: reasonScore,
          status: 'pending',
        });
      } else {
        // Group exists — update metadata
        const existingData = groupDoc.data()!;
        const currentHighest = (existingData.highestReasonScore as number) ?? 0;

        transaction.update(groupRef, {
          lastReportAt: now,
          totalReports: fieldValue.increment(1),
          highestReasonScore: Math.max(currentHighest, reasonScore),
          // Update user info if it was missing
          ...(!existingData.reportedUserId && reportData.reportedUserId
            ? { reportedUserId: reportData.reportedUserId }
            : {}),
          ...(!existingData.reportedUsername && reportData.reportedUsername
            ? { reportedUsername: reportData.reportedUsername }
            : {}),
        });
      }
    });

    logger.info(`Updated report group ${groupDocId} for report ${reportId}`);
  };
}
