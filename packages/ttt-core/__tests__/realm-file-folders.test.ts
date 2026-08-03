// Realm shared-file folders + the promotion approval-gate contracts.
//
// Covers the folder document, its path/registry wiring, the bounded caps, every callable
// input shape, and the two projections. The load-bearing property throughout: a pending
// request and an approved file are structurally different things, so neither projection can
// ever be handed a row from the other lane.

import { describe, it, expect } from 'vitest';
import {
  RealmFileFolderSchema,
  WorkFileFolderSchema,
  WorkRealmSchema,
} from '../src/doc-schemas/work-project';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry';
import { PATH_BUILDERS } from '../src/paths/path-builders';
import { COLLECTION_REFS } from '../src/paths/collection-refs';
import { COLLECTIONS, WORK_REALM_SUBCOLLECTIONS } from '../src/paths/collections';
import {
  MAX_REALM_FILE_FOLDERS,
  MAX_FILE_FOLDER_NAME_LENGTH,
} from '../src/constants/business-work-project';
import {
  REALM_SHARED_FILES_PAGE_LIMIT,
  REALM_FILE_PROMOTION_QUEUE_PAGE_LIMIT,
} from '../src/constants/pagination';
import {
  RealmSharedFileProjectionSchema,
  RealmFileFolderProjectionSchema,
  GetRealmSharedFilesInputSchema,
  GetRealmSharedFilesResponseSchema,
  RealmFilePromotionQueueRowSchema,
  GetRealmFilePromotionQueueInputSchema,
  GetRealmFilePromotionQueueResponseSchema,
  UpdateWorkFileRealmShareInputSchema,
  WithdrawRealmFilePromotionRequestInputSchema,
  AdminUpdateWorkFileRealmUnshareInputSchema,
  ApproveRealmFilePromotionInputSchema,
  DeclineRealmFilePromotionInputSchema,
  CreateRealmFileFolderInputSchema,
  UpdateRealmFileFolderInputSchema,
  DeleteRealmFileFolderInputSchema,
  UpdateRealmFileFolderAssignmentInputSchema,
} from '../src/schemas/work-project-management';
import { WORK_PROJECT_ACTIONS } from '../src/permissions/work-project-permissions-data';

const REGISTRY_PATH = 'workRealms/{workRealmId}/realmFileFolders/{realmFileFolderId}';

const folderDoc = {
  realmFileFolderId: 'folder-1',
  workRealmId: 'realm-1',
  name: 'Concept Art',
  name_lowercase: 'concept art',
  createdBy: { uid: 'steward-1' },
  createdAt: 1,
  updatedAt: 2,
};

describe('RealmFileFolderSchema', () => {
  it('accepts a complete folder document', () => {
    expect(RealmFileFolderSchema.parse(folderDoc)).toMatchObject(folderDoc);
  });

  it.each(Object.keys(folderDoc))('requires %s', (field) => {
    const incomplete: Record<string, unknown> = { ...folderDoc };
    delete incomplete[field];
    expect(RealmFileFolderSchema.safeParse(incomplete).success).toBe(false);
  });

  it('reuses the canonical { uid } user reference for createdBy (never a display snapshot)', () => {
    expect(RealmFileFolderSchema.safeParse({ ...folderDoc, createdBy: 'steward-1' }).success).toBe(
      false,
    );
    const parsed = RealmFileFolderSchema.parse({
      ...folderDoc,
      createdBy: { uid: 'steward-1', displayName: 'Steward' },
    });
    // Same shape the sibling Work folder uses: the uid is the reference, nothing else is kept.
    expect(parsed.createdBy).toEqual({ uid: 'steward-1' });
    expect(WorkFileFolderSchema.safeParse({ ...folderDoc, createdBy: 'x' }).success).toBe(false);
  });

  it('follows the Realm *_lowercase normalized-name convention', () => {
    expect(Object.keys(RealmFileFolderSchema.shape)).toContain('name_lowercase');
    // Same convention as the Realm document's own searchable normalized title.
    expect(Object.keys(WorkRealmSchema.shape)).toContain('workingTitle_lowercase');
  });

  it('carries NO isDefault, NO access lists, and NO stored counts', () => {
    const fields = Object.keys(RealmFileFolderSchema.shape);
    for (const absent of [
      'isDefault',
      'canViewTradeProfessions',
      'canUploadTradeProfessions',
      'canDeleteTradeProfessions',
      'fileCount',
      'storageBytes',
    ]) {
      expect(fields).not.toContain(absent);
    }
    // Those fields exist on the WORK-side folder — the omission here is deliberate, not an
    // oversight: Realm folders are organizational only.
    expect(Object.keys(WorkFileFolderSchema.shape)).toContain('isDefault');
  });
});

describe('Realm folder path + registry wiring', () => {
  it('builds workRealms/{id}/realmFileFolders/{id}', () => {
    const path = PATH_BUILDERS.realmFileFolder('realm-1', 'folder-1');
    expect(path).toEqual([
      COLLECTIONS.WORK_REALMS,
      'realm-1',
      WORK_REALM_SUBCOLLECTIONS.REALM_FILE_FOLDERS,
      'folder-1',
    ]);
    expect(WORK_REALM_SUBCOLLECTIONS.REALM_FILE_FOLDERS).toBe('realmFileFolders');
  });

  it('exposes the collection ref the bounded folder listing/uniqueness queries use', () => {
    expect(COLLECTION_REFS.realmFileFolders('realm-1')).toEqual([
      COLLECTIONS.WORK_REALMS,
      'realm-1',
      WORK_REALM_SUBCOLLECTIONS.REALM_FILE_FOLDERS,
    ]);
  });

  it('is registered in the whole-app document-schema registry', () => {
    expect(COLLECTION_SCHEMAS[REGISTRY_PATH]).toBe(RealmFileFolderSchema);
  });
});

describe('Realm folder bounds', () => {
  it('caps folders per Realm at a named, bounded value', () => {
    expect(Number.isInteger(MAX_REALM_FILE_FOLDERS)).toBe(true);
    expect(MAX_REALM_FILE_FOLDERS).toBeGreaterThan(0);
    expect(MAX_REALM_FILE_FOLDERS).toBeLessThanOrEqual(100);
  });

  it('REUSES the one platform folder-name length — no second realm-specific bound exists', () => {
    const longest = 'a'.repeat(MAX_FILE_FOLDER_NAME_LENGTH);
    expect(
      CreateRealmFileFolderInputSchema.safeParse({ workRealmId: 'realm-1', name: longest }).success,
    ).toBe(true);
    expect(
      CreateRealmFileFolderInputSchema.safeParse({ workRealmId: 'realm-1', name: `${longest}a` })
        .success,
    ).toBe(false);
  });

  it('bounds both realm-file page limits with named constants', () => {
    for (const limit of [REALM_SHARED_FILES_PAGE_LIMIT, REALM_FILE_PROMOTION_QUEUE_PAGE_LIMIT]) {
      expect(Number.isInteger(limit)).toBe(true);
      expect(limit).toBeGreaterThan(0);
    }
  });
});

describe('promotion approval-gate callable inputs', () => {
  it('the share REQUEST carries a client-generated stable requestId', () => {
    expect(
      UpdateWorkFileRealmShareInputSchema.safeParse({
        workProjectId: 'work-1',
        workFileId: 'file-1',
        requestId: 'req-1',
      }).success,
    ).toBe(true);
    // Without it, approval/decline could not compare against the request they observed.
    expect(
      UpdateWorkFileRealmShareInputSchema.safeParse({
        workProjectId: 'work-1',
        workFileId: 'file-1',
      }).success,
    ).toBe(false);
  });

  it('WITHDRAW is addressed by Work coordinates and compares the requestId', () => {
    expect(
      WithdrawRealmFilePromotionRequestInputSchema.safeParse({
        workProjectId: 'work-1',
        workFileId: 'file-1',
        requestId: 'req-1',
      }).success,
    ).toBe(true);
    expect(
      WithdrawRealmFilePromotionRequestInputSchema.safeParse({
        workProjectId: 'work-1',
        workFileId: 'file-1',
      }).success,
    ).toBe(false);
  });

  it('APPROVE requires the folder — there is no default folder to fall back to', () => {
    expect(
      ApproveRealmFilePromotionInputSchema.safeParse({
        workRealmId: 'realm-1',
        mediaAssetId: 'asset-1',
        realmFileFolderId: 'folder-1',
        requestId: 'req-1',
      }).success,
    ).toBe(true);
    expect(
      ApproveRealmFilePromotionInputSchema.safeParse({
        workRealmId: 'realm-1',
        mediaAssetId: 'asset-1',
        requestId: 'req-1',
      }).success,
    ).toBe(false);
  });

  it('DECLINE takes no folder (a declined file never entered the pool) but still compares requestId', () => {
    expect(
      DeclineRealmFilePromotionInputSchema.safeParse({
        workRealmId: 'realm-1',
        mediaAssetId: 'asset-1',
        requestId: 'req-1',
      }).success,
    ).toBe(true);
    expect(
      DeclineRealmFilePromotionInputSchema.safeParse({
        workRealmId: 'realm-1',
        mediaAssetId: 'asset-1',
        requestId: 'req-1',
        realmFileFolderId: 'folder-1',
      }).success,
    ).toBe(false);
    expect(
      DeclineRealmFilePromotionInputSchema.safeParse({
        workRealmId: 'realm-1',
        mediaAssetId: 'asset-1',
      }).success,
    ).toBe(false);
  });

  it('ADMIN un-share takes the two Work coordinates and NO requestId', () => {
    expect(
      AdminUpdateWorkFileRealmUnshareInputSchema.safeParse({
        workProjectId: 'work-1',
        workFileId: 'file-1',
      }).success,
    ).toBe(true);
    // The whole point of the separate schema: an APPROVED file has no pending request, so a
    // required requestId would make the callable unusable against the state it exists to
    // unwind. Passing one is a caller error, not a tolerated extra.
    expect(
      AdminUpdateWorkFileRealmUnshareInputSchema.safeParse({
        workProjectId: 'work-1',
        workFileId: 'file-1',
        requestId: 'req-1',
      }).success,
    ).toBe(false);
  });

  it('ADMIN un-share requires both coordinates and rejects empty ids', () => {
    for (const invalid of [
      { workProjectId: 'work-1' },
      { workFileId: 'file-1' },
      {},
      { workProjectId: '', workFileId: 'file-1' },
      { workProjectId: 'work-1', workFileId: '' },
    ]) {
      expect(AdminUpdateWorkFileRealmUnshareInputSchema.safeParse(invalid).success).toBe(false);
    }
  });

  it('ADMIN un-share carries no authority hint — admin authority is asserted server-side', () => {
    for (const hint of [
      { adminOverride: true },
      { actorMode: 'adminOverride' },
      { reason: 'support ticket' },
    ]) {
      expect(
        AdminUpdateWorkFileRealmUnshareInputSchema.safeParse({
          workProjectId: 'work-1',
          workFileId: 'file-1',
          ...hint,
        }).success,
      ).toBe(false);
    }
  });

  it('ADMIN un-share uses the SAME Work-coordinate atoms as the share request', () => {
    // Same two fields, same bounds — only the requestId differs between the request lane and
    // the post-approval admin lane.
    const coords = { workProjectId: 'work-1', workFileId: 'file-1' };
    expect(AdminUpdateWorkFileRealmUnshareInputSchema.safeParse(coords).success).toBe(true);
    expect(
      UpdateWorkFileRealmShareInputSchema.safeParse({ ...coords, requestId: 'req-1' }).success,
    ).toBe(true);
    expect(Object.keys(AdminUpdateWorkFileRealmUnshareInputSchema.shape)).toEqual([
      'workProjectId',
      'workFileId',
    ]);
  });

  it('folder CRUD inputs carry no access lists (Realm folders are organizational only)', () => {
    expect(
      CreateRealmFileFolderInputSchema.safeParse({
        workRealmId: 'realm-1',
        name: 'Concept Art',
        canViewTradeProfessions: [],
      }).success,
    ).toBe(false);
    expect(
      UpdateRealmFileFolderInputSchema.safeParse({
        workRealmId: 'realm-1',
        realmFileFolderId: 'folder-1',
        name: 'Renamed',
      }).success,
    ).toBe(true);
    expect(
      DeleteRealmFileFolderInputSchema.safeParse({
        workRealmId: 'realm-1',
        realmFileFolderId: 'folder-1',
      }).success,
    ).toBe(true);
  });

  it('folder name inputs reject empty strings', () => {
    expect(
      CreateRealmFileFolderInputSchema.safeParse({ workRealmId: 'realm-1', name: '' }).success,
    ).toBe(false);
    expect(
      UpdateRealmFileFolderInputSchema.safeParse({
        workRealmId: 'realm-1',
        realmFileFolderId: 'folder-1',
        name: '',
      }).success,
    ).toBe(false);
  });

  it('the MOVE input carries a compare-and-set expected current folder', () => {
    expect(
      UpdateRealmFileFolderAssignmentInputSchema.safeParse({
        workRealmId: 'realm-1',
        mediaAssetId: 'asset-1',
        expectedRealmFileFolderId: 'folder-1',
        realmFileFolderId: 'folder-2',
      }).success,
    ).toBe(true);
    // Without the precondition a stale tab would silently undo another tab's move.
    expect(
      UpdateRealmFileFolderAssignmentInputSchema.safeParse({
        workRealmId: 'realm-1',
        mediaAssetId: 'asset-1',
        realmFileFolderId: 'folder-2',
      }).success,
    ).toBe(false);
  });

  it('every approval-gate input is strict — an unknown key is rejected, not ignored', () => {
    const strictCases: Array<[string, { safeParse: (v: unknown) => { success: boolean } }, Record<string, unknown>]> = [
      ['share request', UpdateWorkFileRealmShareInputSchema, { workProjectId: 'w', workFileId: 'f', requestId: 'r' }],
      ['withdraw', WithdrawRealmFilePromotionRequestInputSchema, { workProjectId: 'w', workFileId: 'f', requestId: 'r' }],
      ['approve', ApproveRealmFilePromotionInputSchema, { workRealmId: 'r1', mediaAssetId: 'a', realmFileFolderId: 'f', requestId: 'r' }],
      ['decline', DeclineRealmFilePromotionInputSchema, { workRealmId: 'r1', mediaAssetId: 'a', requestId: 'r' }],
      ['admin un-share', AdminUpdateWorkFileRealmUnshareInputSchema, { workProjectId: 'w', workFileId: 'f' }],
      ['create folder', CreateRealmFileFolderInputSchema, { workRealmId: 'r1', name: 'n' }],
      ['update folder', UpdateRealmFileFolderInputSchema, { workRealmId: 'r1', realmFileFolderId: 'f', name: 'n' }],
      ['delete folder', DeleteRealmFileFolderInputSchema, { workRealmId: 'r1', realmFileFolderId: 'f' }],
      ['move file', UpdateRealmFileFolderAssignmentInputSchema, { workRealmId: 'r1', mediaAssetId: 'a', expectedRealmFileFolderId: 'f1', realmFileFolderId: 'f2' }],
      ['gallery', GetRealmSharedFilesInputSchema, { realmId: 'r1' }],
      ['promotion queue', GetRealmFilePromotionQueueInputSchema, { workRealmId: 'r1' }],
    ];
    for (const [label, schema, valid] of strictCases) {
      expect(schema.safeParse(valid).success, `${label} should accept its valid shape`).toBe(true);
      expect(
        schema.safeParse({ ...valid, sneaky: true }).success,
        `${label} should reject an unknown key`,
      ).toBe(false);
    }
  });
});

describe('gallery projection (APPROVED files only)', () => {
  const file = {
    mediaAssetId: 'asset-1',
    mediaKind: 'image' as const,
    realmFileCanonStatus: 'nonCanon' as const,
    name: 'concept-01.jpg',
    realmFileFolderId: 'folder-1',
    creatorUid: 'creator-1',
    workProjectId: 'work-1',
    workFileId: 'file-1',
  };

  it('accepts an approved file carrying its folder AND the work-file name', () => {
    expect(RealmSharedFileProjectionSchema.parse(file)).toMatchObject(file);
    expect(RealmSharedFileProjectionSchema.safeParse({ ...file, realmFileCanonStatus: 'canon' }).success).toBe(true);
  });

  it('REJECTS a pending or unshared row — the approved lane cannot express one', () => {
    expect(
      RealmSharedFileProjectionSchema.safeParse({ ...file, realmFileCanonStatus: 'pendingApproval' })
        .success,
    ).toBe(false);
    expect(
      RealmSharedFileProjectionSchema.safeParse({ ...file, realmFileCanonStatus: 'none' }).success,
    ).toBe(false);
  });

  it('requires the folder and the name (grouping unnamed thumbnails is not a file browser)', () => {
    for (const field of ['realmFileFolderId', 'name'] as const) {
      const incomplete: Record<string, unknown> = { ...file };
      delete incomplete[field];
      expect(RealmSharedFileProjectionSchema.safeParse(incomplete).success).toBe(false);
    }
  });

  it('stores no display-identity snapshot — only the creator uid', () => {
    const fields = Object.keys(RealmSharedFileProjectionSchema.shape);
    expect(fields).toContain('creatorUid');
    for (const absent of ['creatorDisplayName', 'creatorProfilePictureUrl', 'realmTitle', 'workTitle']) {
      expect(fields).not.toContain(absent);
    }
  });

  it('bounds the page: limit derives from the named constant and cursor is opaque', () => {
    expect(
      GetRealmSharedFilesInputSchema.safeParse({
        realmId: 'realm-1',
        limit: REALM_SHARED_FILES_PAGE_LIMIT,
      }).success,
    ).toBe(true);
    expect(
      GetRealmSharedFilesInputSchema.safeParse({
        realmId: 'realm-1',
        limit: REALM_SHARED_FILES_PAGE_LIMIT + 1,
      }).success,
    ).toBe(false);
    expect(GetRealmSharedFilesInputSchema.safeParse({ realmId: 'realm-1', limit: 0 }).success).toBe(false);
    expect(
      GetRealmSharedFilesInputSchema.safeParse({ realmId: 'realm-1', cursor: 'opaque-token' })
        .success,
    ).toBe(true);
    // A caller must not be able to ask the artisan gallery for pending rows.
    expect(
      GetRealmSharedFilesInputSchema.safeParse({ realmId: 'realm-1', includePending: true }).success,
    ).toBe(false);
  });

  it('keeps { files } and adds folders + nextCursor additively', () => {
    const folder = { realmFileFolderId: 'folder-1', name: 'Concept Art' };
    expect(RealmFileFolderProjectionSchema.parse(folder)).toEqual(folder);
    expect(
      GetRealmSharedFilesResponseSchema.safeParse({ files: [file], folders: [folder] }).success,
    ).toBe(true);
    expect(
      GetRealmSharedFilesResponseSchema.safeParse({
        files: [file],
        folders: [folder],
        nextCursor: 'next',
      }).success,
    ).toBe(true);
    expect(
      GetRealmSharedFilesResponseSchema.safeParse({ files: [], folders: [], nextCursor: null })
        .success,
    ).toBe(true);
    // An empty Realm still returns both arrays, so "no folders yet" is representable.
    expect(GetRealmSharedFilesResponseSchema.safeParse({ files: [] }).success).toBe(false);
  });
});

describe('promotion-queue projection (PENDING rows only)', () => {
  const row = {
    mediaAssetId: 'asset-1',
    mediaKind: 'video' as const,
    realmFileCanonStatus: 'pendingApproval' as const,
    name: 'trailer.mp4',
    creatorUid: 'creator-1',
    workProjectId: 'work-1',
    workFileId: 'file-1',
    realmFileShareRequestId: 'req-1',
    realmFileShareRequestedByUid: 'file-admin-1',
    realmFileShareRequestedAt: 1_700_000_000_000,
  };

  it('accepts a pending request row', () => {
    expect(RealmFilePromotionQueueRowSchema.parse(row)).toMatchObject(row);
  });

  it('REJECTS an approved or unshared row — the queue lane cannot express one', () => {
    for (const status of ['nonCanon', 'canon', 'none']) {
      expect(
        RealmFilePromotionQueueRowSchema.safeParse({ ...row, realmFileCanonStatus: status }).success,
      ).toBe(false);
    }
  });

  it('carries the recorded requester so the resolution is never addressed by guesswork', () => {
    const incomplete: Record<string, unknown> = { ...row };
    delete incomplete.realmFileShareRequestedByUid;
    expect(RealmFilePromotionQueueRowSchema.safeParse(incomplete).success).toBe(false);
  });

  it('carries no folder — a pending file has none until approval assigns one', () => {
    expect(Object.keys(RealmFilePromotionQueueRowSchema.shape)).not.toContain('realmFileFolderId');
    expect(
      RealmFilePromotionQueueRowSchema.safeParse({ ...row, realmFileFolderId: 'folder-1' }).success,
    ).toBe(false);
  });

  it('bounds its own page and returns the folder picker alongside the requests', () => {
    expect(
      GetRealmFilePromotionQueueInputSchema.safeParse({
        workRealmId: 'realm-1',
        limit: REALM_FILE_PROMOTION_QUEUE_PAGE_LIMIT,
      }).success,
    ).toBe(true);
    expect(
      GetRealmFilePromotionQueueInputSchema.safeParse({
        workRealmId: 'realm-1',
        limit: REALM_FILE_PROMOTION_QUEUE_PAGE_LIMIT + 1,
      }).success,
    ).toBe(false);
    expect(
      GetRealmFilePromotionQueueResponseSchema.safeParse({
        requests: [row],
        folders: [{ realmFileFolderId: 'folder-1', name: 'Concept Art' }],
      }).success,
    ).toBe(true);
    // "No folders yet" is explicitly representable so the UI can disable approval and say why.
    expect(
      GetRealmFilePromotionQueueResponseSchema.safeParse({ requests: [row], folders: [] }).success,
    ).toBe(true);
  });
});

describe('permission copy', () => {
  it('describes promoteToRealm as a REQUEST, never an instant share', () => {
    const action = WORK_PROJECT_ACTIONS['workFile.promoteToRealm'];
    expect(action.label.toLowerCase()).toContain('request');
    expect(action.description.toLowerCase()).toContain('request');
    expect(action.description.toLowerCase()).toContain('steward');
    expect(action.description.toLowerCase()).not.toContain('instantly');
  });
});
