import { describe, it, expect } from 'vitest';
import {
  MediaAssetSchema,
  RealmFileCanonStatusSchema,
  RealmFileApprovedStatusSchema,
  RealmFilePendingApprovalStatusSchema,
  RealmFileActiveStatusSchema,
  REALM_FILE_CANON_STATUS_VALUES,
  REALM_FILE_APPROVED_STATUS_VALUES,
  REALM_FILE_ACTIVE_STATUS_VALUES,
  REALM_FILE_PENDING_APPROVAL_STATUS,
  REALM_FILE_NONE_STATUS,
  REALM_FILE_NON_CANON_STATUS,
  REALM_FILE_CANON_STATUS,
} from '../src/doc-schemas/media-assets.js';

const baseWorkFileAsset = {
  mediaAssetId: 'asset-1',
  mediaKind: 'image' as const,
  fileOrigin: 'work-asset' as const,
  ownerType: 'workProject' as const,
  ownerId: 'work-1',
  workProjectId: 'work-1',
  createdByUid: 'uploader-1',
  accessTier: 'scoped' as const,
  servingStatus: 'servable' as const,
  variants: { main: { contentType: 'image/jpeg', sizeBytes: 10 } },
  moderationStatus: 'approved' as const,
  retentionPolicy: 'standard' as const,
  legalHold: false,
  realmFileCanonStatus: 'none' as const,
  createdAt: 1,
  updatedAt: 2,
};

const requestFields = {
  realmFileShareRequestId: 'req-1',
  realmFileShareRequestedByUid: 'file-admin-1',
  realmFileShareRequestedAt: 1_700_000_000_000,
};

const asset = (patch: Record<string, unknown>) => ({ ...baseWorkFileAsset, ...patch });
const ok = (patch: Record<string, unknown>) => MediaAssetSchema.safeParse(asset(patch)).success;
const issuePaths = (patch: Record<string, unknown>) => {
  const result = MediaAssetSchema.safeParse(asset(patch));
  expect(result.success).toBe(false);
  return result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
};

describe('RealmFileCanonStatus — the one seam, carrying the approval gate', () => {
  it('accepts the four canonical standings and nothing else', () => {
    expect([...REALM_FILE_CANON_STATUS_VALUES]).toEqual([
      'none',
      'pendingApproval',
      'nonCanon',
      'canon',
    ]);
    for (const value of REALM_FILE_CANON_STATUS_VALUES) {
      expect(RealmFileCanonStatusSchema.safeParse(value).success).toBe(true);
    }
    expect(RealmFileCanonStatusSchema.safeParse('pending').success).toBe(false);
    expect(RealmFileCanonStatusSchema.safeParse('approved').success).toBe(false);
  });

  it('names every member once and assembles the sets from those names', () => {
    expect(REALM_FILE_NONE_STATUS).toBe('none');
    expect(REALM_FILE_PENDING_APPROVAL_STATUS).toBe('pendingApproval');
    expect(REALM_FILE_NON_CANON_STATUS).toBe('nonCanon');
    expect(REALM_FILE_CANON_STATUS).toBe('canon');

    expect([...REALM_FILE_CANON_STATUS_VALUES]).toEqual([
      REALM_FILE_NONE_STATUS,
      REALM_FILE_PENDING_APPROVAL_STATUS,
      REALM_FILE_NON_CANON_STATUS,
      REALM_FILE_CANON_STATUS,
    ]);
    expect([...REALM_FILE_APPROVED_STATUS_VALUES]).toEqual([
      REALM_FILE_NON_CANON_STATUS,
      REALM_FILE_CANON_STATUS,
    ]);

    for (const member of [
      REALM_FILE_NONE_STATUS,
      REALM_FILE_PENDING_APPROVAL_STATUS,
      REALM_FILE_NON_CANON_STATUS,
      REALM_FILE_CANON_STATUS,
    ]) {
      expect(RealmFileCanonStatusSchema.safeParse(member).success).toBe(true);
    }
    expect(REALM_FILE_CANON_STATUS_VALUES).toHaveLength(4);
  });

  it('exposes an APPROVED subset that excludes the unshared and pending standings', () => {
    expect([...REALM_FILE_APPROVED_STATUS_VALUES]).toEqual(['nonCanon', 'canon']);
    expect(RealmFileApprovedStatusSchema.safeParse('nonCanon').success).toBe(true);
    expect(RealmFileApprovedStatusSchema.safeParse('canon').success).toBe(true);
    expect(RealmFileApprovedStatusSchema.safeParse('pendingApproval').success).toBe(false);
    expect(RealmFileApprovedStatusSchema.safeParse('none').success).toBe(false);
  });

  it('exposes a PENDING-only value the promotion queue projection derives from', () => {
    expect(RealmFilePendingApprovalStatusSchema.safeParse('pendingApproval').success).toBe(true);
    for (const value of ['none', 'nonCanon', 'canon']) {
      expect(RealmFilePendingApprovalStatusSchema.safeParse(value).success).toBe(false);
    }
    expect(REALM_FILE_PENDING_APPROVAL_STATUS).toBe('pendingApproval');
  });

  it('exposes an ACTIVE subset (everything but "none") derived from the two subsets', () => {
    expect([...REALM_FILE_ACTIVE_STATUS_VALUES]).toEqual([
      REALM_FILE_PENDING_APPROVAL_STATUS,
      ...REALM_FILE_APPROVED_STATUS_VALUES,
    ]);
    expect([...REALM_FILE_ACTIVE_STATUS_VALUES].sort()).toEqual(
      REALM_FILE_CANON_STATUS_VALUES.filter((v) => v !== 'none').sort(),
    );
    for (const value of REALM_FILE_ACTIVE_STATUS_VALUES) {
      expect(RealmFileActiveStatusSchema.safeParse(value).success).toBe(true);
    }
    expect(RealmFileActiveStatusSchema.safeParse('none').success).toBe(false);
  });
});

describe("MediaAssetSchema — legal state 'none' (not shared)", () => {
  it('accepts a plain unshared work file', () => {
    expect(ok({})).toBe(true);
  });

  it('accepts an unshared asset from a completely unrelated origin (broad tier, no realm fields)', () => {
    expect(
      MediaAssetSchema.safeParse({
        ...baseWorkFileAsset,
        fileOrigin: 'profile-picture',
        ownerType: 'userProfile',
        ownerId: 'user-1',
        workProjectId: undefined,
        accessTier: 'broad',
      }).success,
    ).toBe(true);
  });

  it('rejects a realmId with no realm standing (a dangling realm pointer)', () => {
    expect(issuePaths({ realmId: 'realm-1' })).toContain('realmId');
  });

  it('rejects a folder assignment with no realm standing', () => {
    expect(issuePaths({ realmFileFolderId: 'folder-1' })).toContain('realmFileFolderId');
  });

  it('rejects leftover request fields — a resolved decline must clear them', () => {
    const paths = issuePaths({ ...requestFields });
    expect(paths).toEqual(
      expect.arrayContaining([
        'realmFileShareRequestId',
        'realmFileShareRequestedByUid',
        'realmFileShareRequestedAt',
      ]),
    );
  });
});

describe("MediaAssetSchema — legal state 'pendingApproval' (requested, undecided)", () => {
  const pending = {
    realmFileCanonStatus: 'pendingApproval' as const,
    realmId: 'realm-1',
    ...requestFields,
  };

  it('accepts a complete pending request', () => {
    expect(ok(pending)).toBe(true);
  });

  it('rejects a pending request with no realmId (nothing identifies the target realm)', () => {
    const { realmId: _omitted, ...noRealm } = pending;
    expect(issuePaths(noRealm)).toContain('realmId');
  });

  it('rejects a pending request that ALREADY carries a folder — approval assigns the folder', () => {
    expect(issuePaths({ ...pending, realmFileFolderId: 'folder-1' })).toContain(
      'realmFileFolderId',
    );
  });

  it.each([
    ['realmFileShareRequestId'],
    ['realmFileShareRequestedByUid'],
    ['realmFileShareRequestedAt'],
  ])('rejects a pending request missing %s', (field) => {
    const incomplete: Record<string, unknown> = { ...pending };
    delete incomplete[field];
    expect(issuePaths(incomplete)).toContain(field);
  });

  it('rejects a pending request with NO request metadata at all', () => {
    const paths = issuePaths({ realmFileCanonStatus: 'pendingApproval', realmId: 'realm-1' });
    expect(paths).toEqual(
      expect.arrayContaining([
        'realmFileShareRequestId',
        'realmFileShareRequestedByUid',
        'realmFileShareRequestedAt',
      ]),
    );
  });
});

describe("MediaAssetSchema — legal states 'nonCanon' / 'canon' (approved into the pool)", () => {
  for (const status of REALM_FILE_APPROVED_STATUS_VALUES) {
    const approved = {
      realmFileCanonStatus: status,
      realmId: 'realm-1',
      realmFileFolderId: 'folder-1',
      accessTier: 'artisan' as const,
    };

    it(`accepts a complete approved ${status} file`, () => {
      expect(ok(approved)).toBe(true);
    });

    it(`rejects an approved ${status} file with no folder — every approved file is in a folder`, () => {
      const { realmFileFolderId: _omitted, ...noFolder } = approved;
      expect(issuePaths(noFolder)).toContain('realmFileFolderId');
    });

    it(`rejects an approved ${status} file with no realmId`, () => {
      const { realmId: _omitted, ...noRealm } = approved;
      expect(issuePaths(noRealm)).toContain('realmId');
    });

    it(`rejects an approved ${status} file still carrying request metadata`, () => {
      const paths = issuePaths({ ...approved, ...requestFields });
      expect(paths).toEqual(
        expect.arrayContaining([
          'realmFileShareRequestId',
          'realmFileShareRequestedByUid',
          'realmFileShareRequestedAt',
        ]),
      );
    });
  }
});

describe('MediaAssetSchema — what the realm-file invariant deliberately does NOT constrain', () => {
  it('leaves accessTier alone: tier is origin-dependent and callable-enforced, not schema-enforced', () => {
    expect(
      ok({
        realmFileCanonStatus: 'pendingApproval',
        realmId: 'realm-1',
        ...requestFields,
        accessTier: 'artisan',
      }),
    ).toBe(true);
    expect(
      ok({
        realmFileCanonStatus: 'canon',
        realmId: 'realm-1',
        realmFileFolderId: 'f-1',
        accessTier: 'scoped',
      }),
    ).toBe(true);
  });

  it('leaves servingStatus orthogonal — a HIDDEN approved file keeps its folder through hide/restore', () => {
    expect(
      ok({
        realmFileCanonStatus: 'canon',
        realmId: 'realm-1',
        realmFileFolderId: 'folder-1',
        accessTier: 'artisan',
        servingStatus: 'hidden',
      }),
    ).toBe(true);
    expect(
      ok({
        realmFileCanonStatus: 'pendingApproval',
        realmId: 'realm-1',
        ...requestFields,
        servingStatus: 'quarantined',
      }),
    ).toBe(true);
  });

  it('rejects unknown keys rather than stripping them — the refinement keeps the schema strict', () => {
    expect(MediaAssetSchema.safeParse(asset({ realmFolderId: 'folder-1' })).success).toBe(false);
    expect(
      MediaAssetSchema.safeParse(
        asset({ realmFileCanonStatus: 'canon', realmId: 'r-1', realmFolderId: 'folder-1' }),
      ).success,
    ).toBe(false);
  });

  it('keeps the ZodObject shape introspectable (the schema-doc generator + drift-check read it)', () => {
    expect(Object.keys(MediaAssetSchema.shape)).toEqual(
      expect.arrayContaining([
        'realmFileCanonStatus',
        'realmFileFolderId',
        'realmFileShareRequestId',
        'realmFileShareRequestedByUid',
        'realmFileShareRequestedAt',
      ]),
    );
  });
});
