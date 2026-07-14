// Load-bearing contract tests for the canonical NCII / TAKE IT DOWN intake derivations.
//
// Every value here is part of the intake KEYSPACE: the deterministic requestId is a
// Firestore doc id, the requestReference is printed on the one-time receipt, the temp-hold
// id keys `nciiTemporaryHolds/{holdId}`, and the cumulative snapshot hash is the immutable
// submission fingerprint. A formula (or version-tag) change silently re-keys every existing
// request, so these assertions hardcode both the exact intermediate key STRINGS and the
// exact hex DIGESTS for fixed inputs — computing a digest in-test would let a drift pass
// unnoticed (both sides would move together). The `\x1f` unit separator is written
// explicitly so an accidental separator change is caught too.

import { describe, it, expect } from 'vitest';
import {
  sha256Hex,
  tempHoldId,
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
import type { TargetLocatorV1 } from '../src/doc-schemas/index.js';

const SEP = '\x1f';

describe('sha256Hex', () => {
  it('is the exact sha256 hex of the utf8 input', () => {
    // NIST test vector for sha256('abc').
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('is the SAME hashing helper as resource-keys.resourceKeyHash (one implementation)', () => {
    // The `./safety` surface must have ONE sha256 chokepoint, never two.
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
    expect(
      normalizedTargetKey({ kind: 'hallItem', hallItemId: 'h1', subItemId: 's2' }),
    ).toBe(`hallItem${SEP}h1${SEP}s2`);
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
    expect(normalizeExternalUrl('  HTTPS://Example.COM/Path  ')).toBe(
      'https://example.com/Path',
    );
  });

  it('lowercases + trims a non-parseable string without throwing', () => {
    expect(normalizeExternalUrl('  Not A URL  ')).toBe('not a url');
  });
});

describe('deterministicRequestId', () => {
  it('builds the exact [H-07] requestId for a fixed idempotencyKey + targetKey', () => {
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
    // Must NOT equal the raw requestId (the whole point of a separate opaque reference).
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
    expect(a).toBe(
      'ee91e6ed98df7ccb65ea1a85aa5cca30f1d5cb42ec08c8dcb7378f4d38651c21',
    );
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
    expect(isTttHostedLocator({ kind: 'chatAttachment', channelId: 'c', messageId: 'm', attachmentId: 'a' })).toBe(true);
  });

  it('is false for external / unresolvable locators (url, additionalText)', () => {
    expect(isTttHostedLocator({ kind: 'url', url: 'https://x' })).toBe(false);
    expect(isTttHostedLocator({ kind: 'additionalText', textRef: 'r' })).toBe(false);
  });
});
