import { describe, expect, it } from 'vitest';
import * as wpm from '../src/schemas/work-project-management';
import { REALM_FILE_NON_CANON_STATUS, REALM_FILE_PENDING_APPROVAL_STATUS } from '../src/doc-schemas/media-assets';

// The Realm gallery and the steward's queue are endless lists an action must patch in place,
// never reload (FRONTEND-103). Their rows are server projections the client cannot read, so a
// Realm-file action answers with the one file's row in each list after it, and the folders whose
// server-computed counts it changed.

const ids = { mediaAssetId: 'asset1', workProjectId: 'wp1', workFileId: 'file1' };

const galleryRow = {
  ...ids,
  mediaKind: 'image' as const,
  realmFileCanonStatus: REALM_FILE_NON_CANON_STATUS,
  name: 'Map',
  realmFileFolderId: 'folder1',
  creatorUid: 'u1',
  createdAt: 1_700_000_000_000,
};

const queueRow = {
  ...ids,
  mediaKind: 'image' as const,
  realmFileCanonStatus: REALM_FILE_PENDING_APPROVAL_STATUS,
  name: 'Map',
  creatorUid: 'u1',
  realmFileShareRequestId: 'req1',
  realmFileShareRequestedByUid: 'u2',
  realmFileShareRequestedAt: 1,
};

describe('a Realm-file action answers with the file in each list after it', () => {
  it('an approval moves the file from the queue into the gallery and counts it in its folder', () => {
    const answer = wpm.RealmFileTransitionResultSchema.parse({
      success: true,
      change: {
        ...ids,
        sharedFile: galleryRow,
        promotionRequest: null,
        shareState: { workFileId: 'file1', realmFileCanonStatus: REALM_FILE_NON_CANON_STATUS },
        folders: [{ realmFileFolderId: 'folder1', name: 'Maps', fileCount: 4 }],
      },
    });
    expect(answer.change.sharedFile?.realmFileFolderId).toBe('folder1');
    expect(answer.change.promotionRequest).toBeNull();
    expect(answer.change.folders[0]?.fileCount).toBe(4);
  });

  it('a request puts the file in the queue only, with the request the steward decides', () => {
    const answer = wpm.RealmFileTransitionResultSchema.parse({
      success: true,
      change: {
        ...ids,
        sharedFile: null,
        promotionRequest: queueRow,
        shareState: { workFileId: 'file1', realmFileCanonStatus: REALM_FILE_PENDING_APPROVAL_STATUS, realmFileShareRequestId: 'req1' },
        folders: [],
      },
    });
    expect(answer.change.promotionRequest?.realmFileShareRequestId).toBe('req1');
  });

  it('every list is answered, even when the file is absent from it', () => {
    const { shareState: _omitted, ...withoutShareState } = { ...ids, sharedFile: null, promotionRequest: null, shareState: null, folders: [] };
    expect(wpm.RealmFileListsChangeSchema.safeParse(withoutShareState).success).toBe(false);
  });

  it('a gallery slot never holds a pending file, and the queue never an approved one', () => {
    const change = { ...ids, promotionRequest: null, shareState: null, folders: [] };
    expect(wpm.RealmFileListsChangeSchema.safeParse({ ...change, sharedFile: { ...galleryRow, realmFileCanonStatus: REALM_FILE_PENDING_APPROVAL_STATUS } }).success).toBe(false);
    expect(
      wpm.RealmFileListsChangeSchema.safeParse({ ...change, sharedFile: null, promotionRequest: { ...queueRow, realmFileCanonStatus: REALM_FILE_NON_CANON_STATUS } }).success,
    ).toBe(false);
  });
});

describe('a Realm folder action answers with the folder', () => {
  it('create and rename answer the folder as the gallery shows it', () => {
    const folder = { realmFileFolderId: 'folder1', name: 'Maps', fileCount: 0 };
    expect(wpm.RealmFileFolderResultSchema.parse({ success: true, folder }).folder).toEqual(folder);
  });

  it('delete answers the id of the folder it removed', () => {
    expect(wpm.DeleteRealmFileFolderResultSchema.parse({ success: true, realmFileFolderId: 'folder1' }).realmFileFolderId).toBe('folder1');
    expect(wpm.DeleteRealmFileFolderResultSchema.safeParse({ success: true }).success).toBe(false);
  });
});

describe('a gallery row carries the order the gallery reads by', () => {
  it('an approved row holds its asset createdAt, so it is placed among the loaded rows in order', () => {
    expect(wpm.RealmSharedFileProjectionSchema.parse(galleryRow).createdAt).toBe(1_700_000_000_000);
    const { createdAt: _omitted, ...withoutOrder } = galleryRow;
    expect(wpm.RealmSharedFileProjectionSchema.safeParse(withoutOrder).success).toBe(false);
  });
});
