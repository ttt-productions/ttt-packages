import type { ServerFirestore, ServerReportCoreConfig } from './types.js';
import { buildUserReportAdminTaskDoc } from './buildUserReportAdminTaskDoc.js';

export interface AdminTaskHandlerConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

/**
 * Factory that returns the handler logic for when a report group is created.
 * Creates an adminTasks entry with a calculated priority score.
 *
 * The app registers this as an onDocumentCreated trigger on the reportGroups collection.
 * The task's id convention, stored shape, priority formula, and summary copy are owned by
 * `buildUserReportAdminTaskDoc` — this handler is the standalone-write adapter over it; a
 * caller that must write the task inside its own transaction uses the builder directly.
 *
 * @returns An async handler: (groupData, groupId) => Promise<void>
 */
export function createAdminTaskHandler({
  config,
  db,
  logger = console,
}: AdminTaskHandlerConfig) {
  return async (groupData: Record<string, unknown>, groupId: string): Promise<void> => {
    if (!groupData) return;

    const { adminTaskId, doc } = buildUserReportAdminTaskDoc({
      config,
      groupData,
      groupId,
      now: Date.now(),
    });
    const adminTaskRef = db.collection(config.collections.adminTasks).doc(adminTaskId);
    await adminTaskRef.set(doc);

    logger.info(`Created adminTask ${adminTaskId} for report group ${groupId} with priority ${doc.priority}`);
  };
}
