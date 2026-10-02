import type { WorkFileFolder } from '../doc-schemas/work-project.js';

/** Fixed id of a Work's default file folder — exactly one per Work, created with the Work. */
export const DEFAULT_WORK_FILE_FOLDER_ID = 'default';

/** The default folder's name, as every guildmate sees it — the folder and any copy naming it read this. */
export const DEFAULT_WORK_FILE_FOLDER_NAME = 'All Guildmates';

/**
 * The default folder every Work gets at creation: view and upload open to every active
 * guildmate (no trade-profession gating), delete and manage left to the file admins. The Work's
 * creator and the e2e seed both build it here, so a seeded Work holds the same folder a real one does.
 */
export function buildDefaultWorkFileFolder(workProjectId: string, createdByUid: string, now: number): WorkFileFolder {
  return {
    workFileFolderId: DEFAULT_WORK_FILE_FOLDER_ID,
    workProjectId,
    name: DEFAULT_WORK_FILE_FOLDER_NAME,
    isDefault: true,
    canViewTradeProfessions: [],
    canUploadTradeProfessions: [],
    canDeleteTradeProfessions: [],
    fileCount: 0,
    storageBytes: 0,
    createdBy: { uid: createdByUid },
    createdAt: now,
    updatedAt: now,
  };
}
