import type { WorkFileFolder } from '../doc-schemas/work-project.js';

export const DEFAULT_WORK_FILE_FOLDER_ID = 'default';

export const DEFAULT_WORK_FILE_FOLDER_NAME = 'All Guildmates';

export function buildDefaultWorkFileFolder(
  workProjectId: string,
  createdByUid: string,
  now: number,
): WorkFileFolder {
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
