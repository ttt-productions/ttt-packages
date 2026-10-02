import { describe, it, expect } from 'vitest';
import { DEFAULT_WORK_FILE_FOLDER_ID, DEFAULT_WORK_FILE_FOLDER_NAME, buildDefaultWorkFileFolder } from '../src/utils';
import { WorkFileFolderSchema } from '../src/doc-schemas/work-project';
import { documentIdSegmentSchema } from '../src/schemas/atoms';

describe('the default Work file folder', () => {
  const folder = buildDefaultWorkFileFolder('wp1', 'steward1', 1_000);

  it('is a valid stored folder document', () => {
    expect(WorkFileFolderSchema.safeParse(folder).success).toBe(true);
  });

  it('lives at the one fixed folder id of its Work', () => {
    expect(folder.workFileFolderId).toBe(DEFAULT_WORK_FILE_FOLDER_ID);
    expect(folder.workProjectId).toBe('wp1');
    expect(documentIdSegmentSchema.safeParse(DEFAULT_WORK_FILE_FOLDER_ID).success).toBe(true);
  });

  it('is the default folder, named for every guildmate', () => {
    expect(folder.isDefault).toBe(true);
    expect(DEFAULT_WORK_FILE_FOLDER_NAME).toBe('All Guildmates');
    expect(folder.name).toBe(DEFAULT_WORK_FILE_FOLDER_NAME);
  });

  it('gates nothing on trade professions', () => {
    expect(folder.canViewTradeProfessions).toEqual([]);
    expect(folder.canUploadTradeProfessions).toEqual([]);
    expect(folder.canDeleteTradeProfessions).toEqual([]);
  });

  it('starts empty, created by the Work creator at the creation time', () => {
    expect(folder.fileCount).toBe(0);
    expect(folder.storageBytes).toBe(0);
    expect(folder.createdBy).toEqual({ uid: 'steward1' });
    expect(folder.createdAt).toBe(1_000);
    expect(folder.updatedAt).toBe(1_000);
  });
});
