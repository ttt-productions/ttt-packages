import type { ServerFirestore, ServerReportCoreConfig } from './types.js';
import { buildUserReportAdminTaskDoc } from './buildUserReportAdminTaskDoc.js';

export interface AdminTaskHandlerConfig {
  config: ServerReportCoreConfig;
  db: ServerFirestore;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

export function createAdminTaskHandler({ config, db, logger = console }: AdminTaskHandlerConfig) {
  return async (
    groupData: Record<string, unknown> | null | undefined,
    groupId: string,
  ): Promise<void> => {
    if (!groupData) return;

    const { adminTaskId, doc } = buildUserReportAdminTaskDoc({
      config,
      groupData,
      groupId,
      now: Date.now(),
    });
    const adminTaskRef = db.collection(config.collections.adminTasks).doc(adminTaskId);
    await adminTaskRef.set(doc);

    logger.info(
      `Created adminTask ${adminTaskId} for report group ${groupId} with priority ${doc.priority}`,
    );
  };
}
