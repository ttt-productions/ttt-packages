// The media edge-serving contract shared by the Functions signer / authority client and the media
// Worker: the authority envelope's byte budget, the one grant-scope definition, and the one
// browser-cache policy.

import { describe, it, expect } from 'vitest';
import {
  MEDIA_AUTHORITY_APPLY_MAX_BODY_BYTES,
  MEDIA_BROAD_BROWSER_MAX_AGE_SEC,
  MEDIA_BROWSER_CACHE_CONTROL_BY_ACCESS_TIER,
  MEDIA_BROWSER_NO_STORE,
  MediaAuthorityApplyRequestSchema,
  MediaGrantScopeSchema,
  MediaGrantTokenPayloadSchema,
  MediaSessionTokenPayloadSchema,
  mediaBrowserCacheControl,
  type EdgeServingRecord,
  type MediaAuthorityApplyRequest,
  type MediaGrantScope,
} from '../src/media/edge-serving-contract';
import {
  MEDIA_VARIANT_KEYS,
  MediaAccessTierSchema,
  MediaAssetOwnerTypeSchema,
  type MediaServingAuthorityRecord,
} from '../src/doc-schemas/media-assets';
import { MAX_DOWNLOAD_FILENAME_BYTES } from '../src/constants/media-download';
import { CreateMediaGrantInputSchema } from '../src/schemas/media';

// Firestore's document-id limit: no id the backend can put in a record is longer.
const MAX_DOC_ID_BYTES = 1500;
// RFC 6838: a type and a subtype of at most 127 characters each.
const MAX_CONTENT_TYPE_LENGTH = 127 + 1 + 127;

describe('MEDIA_AUTHORITY_APPLY_MAX_BODY_BYTES', () => {
  it('fits the largest envelope a legitimate apply can send, with wide headroom', () => {
    const id = 'x'.repeat(MAX_DOC_ID_BYTES);
    const longestOwnerType = [...MediaAssetOwnerTypeSchema.options].sort((a, b) => b.length - a.length)[0];
    const variant = {
      contentType: 'c'.repeat(MAX_CONTENT_TYPE_LENGTH),
      sizeBytes: Number.MAX_SAFE_INTEGER,
      // A two-byte character fills the filename's byte cap with the fewest characters, so the
      // JSON form is at its longest.
      downloadFilename: 'é'.repeat(MAX_DOWNLOAD_FILENAME_BYTES / 2),
    };
    const record: MediaServingAuthorityRecord = {
      schemaVersion: Number.MAX_SAFE_INTEGER,
      assetId: id,
      authorityVersion: Number.MAX_SAFE_INTEGER,
      operationId: 'o'.repeat(64),
      payloadHash: 'h'.repeat(64),
      servingStatus: 'quarantined',
      accessTier: 'adminOnly',
      ownerType: longestOwnerType,
      ownerId: id,
      scope: { kind: 'workFileFolder', workProjectId: id, workFileFolderId: id },
      variants: Object.fromEntries(MEDIA_VARIANT_KEYS.map((key) => [key, variant])),
      updatedAtMs: Number.MAX_SAFE_INTEGER,
    };
    const request: MediaAuthorityApplyRequest = { record, requiredVariants: [...MEDIA_VARIANT_KEYS] };
    expect(MediaAuthorityApplyRequestSchema.safeParse(request).success).toBe(true);
    const bytes = new TextEncoder().encode(JSON.stringify(request)).byteLength;
    expect(bytes).toBeLessThan(MEDIA_AUTHORITY_APPLY_MAX_BODY_BYTES / 4);
  });

  it('is a whole number of bytes', () => {
    expect(Number.isInteger(MEDIA_AUTHORITY_APPLY_MAX_BODY_BYTES)).toBe(true);
  });
});

describe('MediaGrantScopeSchema — the one grant scope for the signer and the Worker', () => {
  const everyKind: MediaGrantScope[] = [
    { w: 'work-1' },
    { t: 'commissionProposal', o: 'proposal-1' },
    { wf: { w: 'work-1', f: 'folder-1' } },
    { gi: 'invite-1' },
    { as: { d: 'dispatch-1' } },
    { ar: 'asset-1' },
    { rp: 'asset-2' },
  ];

  it('accepts each scope kind the signer mints', () => {
    for (const scope of everyKind) expect(MediaGrantScopeSchema.parse(scope)).toEqual(scope);
  });

  it('accepts a Realm-steward preview naming exactly one asset', () => {
    expect(MediaGrantScopeSchema.safeParse({ rp: 'asset-2' }).success).toBe(true);
    expect(MediaGrantScopeSchema.safeParse({ rp: '' }).success).toBe(false);
  });

  it('refuses a scope naming two kinds, or none', () => {
    expect(MediaGrantScopeSchema.safeParse({ w: 'work-1', gi: 'invite-1' }).success).toBe(false);
    expect(MediaGrantScopeSchema.safeParse({ ar: 'asset-1', rp: 'asset-1' }).success).toBe(false);
    expect(MediaGrantScopeSchema.safeParse({}).success).toBe(false);
  });

  it('refuses a half owner scope and an owner type outside the canonical owner types', () => {
    expect(MediaGrantScopeSchema.safeParse({ t: 'commissionProposal' }).success).toBe(false);
    expect(MediaGrantScopeSchema.safeParse({ t: 'proposal', o: 'proposal-1' }).success).toBe(false);
  });

  it('refuses a folder or thread scope missing its inner id', () => {
    expect(MediaGrantScopeSchema.safeParse({ wf: { w: 'work-1' } }).success).toBe(false);
    expect(MediaGrantScopeSchema.safeParse({ as: {} }).success).toBe(false);
  });

  it('validates the whole grant payload the signer writes', () => {
    const payload = { v: 1, typ: 'grant', uid: 'user-1', exp: 1_700_000_900, scope: { rp: 'asset-2' } };
    expect(MediaGrantTokenPayloadSchema.parse(payload)).toEqual(payload);
    expect(MediaGrantTokenPayloadSchema.safeParse({ ...payload, typ: 'session' }).success).toBe(false);
    expect(MediaGrantTokenPayloadSchema.safeParse({ ...payload, uid: '' }).success).toBe(false);
    expect(MediaGrantTokenPayloadSchema.safeParse({ ...payload, scope: { w: 'a', t: 'hallItem', o: 'b' } }).success).toBe(
      false,
    );
    expect(MediaGrantTokenPayloadSchema.safeParse({ ...payload, bearer: true }).success).toBe(false);
  });
});

describe('CreateMediaGrantInputSchema — the Realm-steward preview request', () => {
  const request = {
    scopeKind: 'realmFilePreview',
    workRealmId: 'realm-1',
    mediaAssetId: 'asset-2',
    realmFileShareRequestId: 'request-1',
  };

  it('names the Realm, the one pending file, and the request the steward saw', () => {
    expect(CreateMediaGrantInputSchema.parse(request)).toEqual(request);
  });

  it('refuses a preview without the request id or with extra keys', () => {
    const { realmFileShareRequestId: _requestId, ...noRequest } = request;
    expect(CreateMediaGrantInputSchema.safeParse(noRequest).success).toBe(false);
    expect(CreateMediaGrantInputSchema.safeParse({ ...request, workProjectId: 'work-1' }).success).toBe(false);
  });
});

describe('the browser-cache policy by access tier', () => {
  it('lets a browser reuse broad-tier media for fifteen minutes', () => {
    expect(MEDIA_BROAD_BROWSER_MAX_AGE_SEC).toBe(900);
    expect(MEDIA_BROWSER_CACHE_CONTROL_BY_ACCESS_TIER.broad).toBe('private, max-age=900');
  });

  it('classifies every access tier', () => {
    expect(Object.keys(MEDIA_BROWSER_CACHE_CONTROL_BY_ACCESS_TIER).sort()).toEqual(
      [...MediaAccessTierSchema.options].sort(),
    );
  });

  it('never gives scoped, adminOnly, or artisan media a browser max-age', () => {
    for (const tier of ['scoped', 'adminOnly', 'artisan'] as const) {
      expect(MEDIA_BROWSER_CACHE_CONTROL_BY_ACCESS_TIER[tier]).toBe(MEDIA_BROWSER_NO_STORE);
    }
    expect(MEDIA_BROWSER_NO_STORE).toBe('private, no-store');
  });

  it('never gives media served under a grant a browser max-age, broad tier included', () => {
    for (const accessTier of MediaAccessTierSchema.options) {
      expect(mediaBrowserCacheControl({ accessTier, ownerType: 'hallItem', servedUnderGrant: true })).toBe(
        MEDIA_BROWSER_NO_STORE,
      );
    }
  });

  it('never gives safety evidence a browser max-age, whatever its tier', () => {
    expect(mediaBrowserCacheControl({ accessTier: 'broad', ownerType: 'safetyEvidence', servedUnderGrant: false })).toBe(
      MEDIA_BROWSER_NO_STORE,
    );
  });

  it("serves ordinary media with its tier's entry", () => {
    expect(mediaBrowserCacheControl({ accessTier: 'broad', ownerType: 'hallItem', servedUnderGrant: false })).toBe(
      'private, max-age=900',
    );
    expect(mediaBrowserCacheControl({ accessTier: 'scoped', ownerType: 'workProject', servedUnderGrant: false })).toBe(
      MEDIA_BROWSER_NO_STORE,
    );
  });

  it('takes the owner type from the canonical owner types, so a misspelled one cannot slip past the evidence rule', () => {
    // @ts-expect-error 'safetyEvidences' is not a media-asset owner type
    mediaBrowserCacheControl({ accessTier: 'broad', ownerType: 'safetyEvidences', servedUnderGrant: false });
    const record: EdgeServingRecord = {
      servingStatus: 'servable',
      accessTier: 'broad',
      // @ts-expect-error an edge record's owner type is a canonical media-asset owner type
      ownerType: 'hallItems',
      ownerId: 'hall-1',
      variants: {},
    };
    expect(record.ownerId).toBe('hall-1');
  });

  it('never carries immutable on a browser directive', () => {
    for (const directive of Object.values(MEDIA_BROWSER_CACHE_CONTROL_BY_ACCESS_TIER)) {
      expect(directive).not.toContain('immutable');
    }
  });
});

describe('MediaAuthorityApplyRequestSchema — the one signed apply body', () => {
  const record: MediaServingAuthorityRecord = {
    schemaVersion: 1,
    assetId: 'asset-1',
    authorityVersion: 1,
    operationId: 'op-1',
    payloadHash: 'hash-1',
    servingStatus: 'servable',
    accessTier: 'broad',
    ownerType: 'hallItem',
    ownerId: 'hall-1',
    scope: null,
    variants: {
      main: { contentType: 'video/mp4', sizeBytes: 10 },
      poster: { contentType: 'image/jpeg', sizeBytes: 2 },
    },
    updatedAtMs: 1_700_000_000_000,
  };

  it('accepts a servable record that requires exactly its own variants', () => {
    const request = { record, requiredVariants: ['poster', 'main'] };
    expect(MediaAuthorityApplyRequestSchema.parse(request)).toEqual(request);
  });

  it('refuses a servable record whose required list is empty, partial, extra, or repeated', () => {
    for (const requiredVariants of [[], ['main'], ['main', 'poster', 'full'], ['main', 'main', 'poster']]) {
      expect(MediaAuthorityApplyRequestSchema.safeParse({ record, requiredVariants }).success, String(requiredVariants)).toBe(
        false,
      );
    }
  });

  it('lets a non-servable record require none or some of its own variants', () => {
    const hidden = { ...record, servingStatus: 'hidden' as const };
    expect(MediaAuthorityApplyRequestSchema.safeParse({ record: hidden, requiredVariants: [] }).success).toBe(true);
    expect(MediaAuthorityApplyRequestSchema.safeParse({ record: hidden, requiredVariants: ['main'] }).success).toBe(true);
  });

  it('refuses, on a record of any status, a required variant the record does not have', () => {
    const hidden = { ...record, servingStatus: 'hidden' as const };
    expect(MediaAuthorityApplyRequestSchema.safeParse({ record: hidden, requiredVariants: ['full'] }).success).toBe(false);
  });

  it('refuses, on a record of any status, a required variant named twice', () => {
    const hidden = { ...record, servingStatus: 'hidden' as const };
    expect(MediaAuthorityApplyRequestSchema.safeParse({ record: hidden, requiredVariants: ['main', 'main'] }).success).toBe(
      false,
    );
  });

  it('stays strict on the body and on the record it carries', () => {
    expect(MediaAuthorityApplyRequestSchema.safeParse({ record, requiredVariants: ['main', 'poster'], extra: 1 }).success).toBe(
      false,
    );
    expect(
      MediaAuthorityApplyRequestSchema.safeParse({ record: { ...record, url: 'x' }, requiredVariants: ['main', 'poster'] })
        .success,
    ).toBe(false);
  });
});

describe('MediaSessionTokenPayloadSchema — the one media-session cookie payload', () => {
  const payload = { v: 1, typ: 'session', uid: 'user-1', art: 1, adm: 0, iat: 1_700_000_000, exp: 1_700_003_600 };

  it('accepts the payload the media-session route signs', () => {
    expect(MediaSessionTokenPayloadSchema.parse(payload)).toEqual(payload);
  });

  it('refuses a grant, a missing uid, a non-bit flag, or an extra claim', () => {
    expect(MediaSessionTokenPayloadSchema.safeParse({ ...payload, typ: 'grant' }).success).toBe(false);
    expect(MediaSessionTokenPayloadSchema.safeParse({ ...payload, uid: '' }).success).toBe(false);
    expect(MediaSessionTokenPayloadSchema.safeParse({ ...payload, adm: 2 }).success).toBe(false);
    expect(MediaSessionTokenPayloadSchema.safeParse({ ...payload, adm: true }).success).toBe(false);
    expect(MediaSessionTokenPayloadSchema.safeParse({ ...payload, scope: { w: 'work-1' } }).success).toBe(false);
  });

  it('requires the issue and expiry times', () => {
    const { exp: _exp, ...noExpiry } = payload;
    expect(MediaSessionTokenPayloadSchema.safeParse(noExpiry).success).toBe(false);
  });
});
