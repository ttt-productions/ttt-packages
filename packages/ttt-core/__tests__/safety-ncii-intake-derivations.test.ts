// These values are stored document ids and printed references: a formula change re-keys every
// stored request, so the digests are hardcoded rather than computed in-test.

import { describe, it, expect } from 'vitest';
import {
  sha256Hex,
  tempHoldId,
  firstSubmissionId,
  intakeActionId,
  nciiCaseIdForRequest,
  validityDecisionId,
  validityActionId,
  normalizedTargetKey,
  normalizeExternalUrl,
  deterministicRequestId,
  deriveRequestReference,
  cumulativeSnapshotHash,
  surfaceLabelFor,
  targetLocatorSummary,
  isTttHostedLocator,
} from '../src/safety/ncii-intake-derivations.js';
import { resourceKeyHash } from '../src/safety/resource-keys.js';
import type { TargetLocatorV1 } from '../src/doc-schemas/safety/foundation.js';

const SEP = '\x1f';

describe('sha256Hex', () => {
  it('is the exact sha256 hex of the utf8 input', () => {
    // NIST test vector for sha256('abc').
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('is the SAME hashing helper as resource-keys.resourceKeyHash (one implementation)', () => {
    expect(sha256Hex).toBe(resourceKeyHash);
    expect(sha256Hex('abc')).toBe(resourceKeyHash('abc'));
  });
});

describe('tempHoldId', () => {
  it('builds the exact deterministic nciiTemporaryHolds doc id', () => {
    expect(tempHoldId('req_1')).toBe(sha256Hex('nciiTemporaryHold:v1:req_1'));
    expect(tempHoldId('req_1')).toBe(
      'c8847057e2e60d82d9fca8df67aed23645d688fd00a3bed3bbdab8002f41c43f',
    );
  });
});

describe('intake document ids', () => {
  it("builds the exact deterministic id of a request's first submission", () => {
    expect(firstSubmissionId('req_1')).toBe(
      'd8cbc58070bfe0d00d5453ce6053403d288df218443767257e840a968ebe48fc',
    );
  });

  it("builds the exact deterministic id of a request's intake-received action", () => {
    expect(intakeActionId('req_1')).toBe(
      'e53395b0a3edb3d428ad22aa41f60dfcd557a386ef3536e0e3a7363a636ee1e3',
    );
  });

  it('a different request gets different submission and action ids', () => {
    expect(firstSubmissionId('req_2')).not.toBe(firstSubmissionId('req_1'));
    expect(intakeActionId('req_2')).not.toBe(intakeActionId('req_1'));
  });
});

describe('validity document ids', () => {
  it("builds the exact deterministic id of a request's NCII case", () => {
    expect(nciiCaseIdForRequest('req_1')).toBe(
      '0093c428a4442cfdd465ebd150130549cdfa6a74ffefdb387206a763a19ec27c',
    );
  });

  it('builds the exact deterministic id of a validity decision', () => {
    expect(validityDecisionId('req_1', 'valid', 'admin_1', 0)).toBe(
      '702d9e4a8968fef8b5f5b7f1251bb34e792a7c33bc9f13eb249d99517617e0fe',
    );
  });

  it('builds the exact deterministic id of a validity-decided action', () => {
    expect(validityActionId('req_1', 'valid', 0)).toBe(
      'afb3648f861955d2de6b9fc88da6dd8d226782af000bc4d48efe81ee0730a710',
    );
  });

  it('a different result or sequence gets a different validity-decided action id', () => {
    expect(validityActionId('req_1', 'invalid', 0)).toBe(
      '90f19adf8fec33ece822e59646f0866429f9dc82240a4afcf8a41bb00e037510',
    );
    expect(validityActionId('req_1', 'valid', 1)).toBe(
      'bcc9d9b8311c43751ee4c90ce3a1ed76bcd91e2580e3bacbe12186342b39927e',
    );
  });
});

describe('normalizedTargetKey', () => {
  it('joins the discriminant + identity fields with the unit separator', () => {
    expect(normalizedTargetKey({ kind: 'mediaAsset', mediaAssetId: 'asset_1' })).toBe(
      `mediaAsset${SEP}asset_1`,
    );
  });

  it('emits an empty trailing segment for an absent optional field (hallItem subItemId)', () => {
    expect(normalizedTargetKey({ kind: 'hallItem', hallItemId: 'h1' })).toBe(
      `hallItem${SEP}h1${SEP}`,
    );
    expect(normalizedTargetKey({ kind: 'hallItem', hallItemId: 'h1', subItemId: 's2' })).toBe(
      `hallItem${SEP}h1${SEP}s2`,
    );
  });

  it('normalizes the external url so trivially-different spellings collapse', () => {
    expect(normalizedTargetKey({ kind: 'url', url: '  HTTPS://Example.COM/Path  ' })).toBe(
      `url${SEP}https://example.com/Path`,
    );
  });

  it('keys additionalText by its textRef', () => {
    expect(normalizedTargetKey({ kind: 'additionalText', textRef: 'ref_9' })).toBe(
      `additionalText${SEP}ref_9`,
    );
  });
});

describe('normalizeExternalUrl', () => {
  it('trims + lowercases scheme/host while preserving the path case', () => {
    expect(normalizeExternalUrl('  HTTPS://Example.COM/Path  ')).toBe('https://example.com/Path');
  });

  it('lowercases + trims a non-parseable string without throwing', () => {
    expect(normalizeExternalUrl('  Not A URL  ')).toBe('not a url');
  });
});

describe('deterministicRequestId', () => {
  it('builds the exact requestId for a fixed idempotencyKey + targetKey', () => {
    const targetKey = normalizedTargetKey({ kind: 'mediaAsset', mediaAssetId: 'asset_1' });
    expect(deterministicRequestId('idem_1', targetKey)).toBe(
      sha256Hex(`takeItDownRequest:v1:idem_1:${targetKey}`),
    );
    expect(deterministicRequestId('idem_1', targetKey)).toBe(
      '3825983a3b52afeb76b219a3119bec32851e1f7bee658569da4433d7a3106e75',
    );
  });

  it('re-derives the SAME id for the same inputs (idempotent) and a different id otherwise', () => {
    const tk = normalizedTargetKey({ kind: 'mediaAsset', mediaAssetId: 'asset_1' });
    expect(deterministicRequestId('idem_1', tk)).toBe(deterministicRequestId('idem_1', tk));
    expect(deterministicRequestId('idem_1', tk)).not.toBe(deterministicRequestId('idem_2', tk));
  });
});

describe('deriveRequestReference', () => {
  it('is a distinct 32-hex-char derivation of the requestId', () => {
    const ref = deriveRequestReference('req_1');
    expect(ref).toHaveLength(32);
    expect(ref).toBe(sha256Hex('takeItDownRequestRef:v1:req_1').slice(0, 32));
    expect(ref).toBe('6a796b042bc82361154be76f22190baa');
    expect(ref).not.toBe('req_1');
  });
});

describe('cumulativeSnapshotHash', () => {
  it('is append-order independent (sorts the supplied field codes) and pins the exact digest', () => {
    const targetKey = normalizedTargetKey({ kind: 'mediaAsset', mediaAssetId: 'asset_1' });
    const a = cumulativeSnapshotHash({
      requesterRole: 'depictedPerson',
      targetKey,
      suppliedFieldCodes: ['nonconsentStatement', 'contactEmail'],
    });
    const b = cumulativeSnapshotHash({
      requesterRole: 'depictedPerson',
      targetKey,
      suppliedFieldCodes: ['contactEmail', 'nonconsentStatement'],
    });
    expect(a).toBe(b);
    expect(a).toBe('ee91e6ed98df7ccb65ea1a85aa5cca30f1d5cb42ec08c8dcb7378f4d38651c21');
  });

  it('changes when the requester role changes', () => {
    const targetKey = normalizedTargetKey({ kind: 'mediaAsset', mediaAssetId: 'asset_1' });
    const asDepicted = cumulativeSnapshotHash({
      requesterRole: 'depictedPerson',
      targetKey,
      suppliedFieldCodes: ['contactEmail'],
    });
    const asRep = cumulativeSnapshotHash({
      requesterRole: 'authorizedRepresentative',
      targetKey,
      suppliedFieldCodes: ['contactEmail'],
    });
    expect(asDepicted).not.toBe(asRep);
  });
});

describe('surfaceLabelFor / targetLocatorSummary', () => {
  it('returns the privacy-safe surface label per kind', () => {
    expect(surfaceLabelFor({ kind: 'mediaAsset', mediaAssetId: 'x' })).toBe('Media item');
    expect(surfaceLabelFor({ kind: 'url', url: 'https://x' })).toBe('External link');
    expect(surfaceLabelFor({ kind: 'additionalText', textRef: 'r' })).toBe('Described content');
  });

  it('builds a summary carrying only {kind, surfaceLabel, hasResolvedTarget} — no ids/narrative', () => {
    const locator: TargetLocatorV1 = { kind: 'mediaAsset', mediaAssetId: 'asset_1' };
    expect(targetLocatorSummary(locator, true)).toEqual({
      kind: 'mediaAsset',
      surfaceLabel: 'Media item',
      hasResolvedTarget: true,
    });
    expect(targetLocatorSummary({ kind: 'url', url: 'https://x' }, false)).toEqual({
      kind: 'url',
      surfaceLabel: 'External link',
      hasResolvedTarget: false,
    });
  });
});

describe('isTttHostedLocator', () => {
  it('is true for server-resolvable TTT-hosted kinds', () => {
    expect(isTttHostedLocator({ kind: 'mediaAsset', mediaAssetId: 'x' })).toBe(true);
    expect(
      isTttHostedLocator({
        kind: 'conversationFile',
        conversation: { kind: 'guildInvite', guildInviteId: 'inv-1' },
        conversationFileId: 'cf-1',
        mediaAssetId: 'asset-1',
      }),
    ).toBe(true);
  });

  it('is false for external / unresolvable locators (url, additionalText)', () => {
    expect(isTttHostedLocator({ kind: 'url', url: 'https://x' })).toBe(false);
    expect(isTttHostedLocator({ kind: 'additionalText', textRef: 'r' })).toBe(false);
  });
});
