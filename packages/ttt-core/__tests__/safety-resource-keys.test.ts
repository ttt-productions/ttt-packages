// Load-bearing contract tests for the canonical safety-hold resource keys.
//
// The canonical key string AND its sha256 hash are the Firestore doc id for every hold
// aggregate + ref. A format change re-keys EVERY existing hold (a silent, catastrophic
// migration), so these assertions hardcode both the exact canonical string and the exact
// hex digest for fixed inputs — computing the hash in-test would let a format drift pass
// unnoticed (both sides would move together). The `\x1f` unit separator is written
// explicitly so an accidental separator change is caught too.

import { describe, it, expect } from 'vitest';
import {
  resourceKeyHash,
  contentDocResourceKey,
  storageObjectResourceKey,
  mediaAssetResourceKeys,
  rootIngestResourceKey,
  chatMessageRangeResourceKey,
  channelResourceKey,
  accountResourceKey,
} from '../src/safety/resource-keys.js';

const SEP = '\x1f';
const KEY = 'safetyHoldKey/v1';

describe('contentDocResourceKey', () => {
  const docPath = 'allWorkProjects/p1/workProjectTales/t1';

  it('builds the exact canonical string + hash for a revision-agnostic "current" hold', () => {
    const k = contentDocResourceKey(docPath, 'current');
    expect(k.resourceType).toBe('contentDoc');
    expect(k.resourceId).toBe(docPath);
    expect(k.canonicalResourceKey).toBe(`${KEY}${SEP}contentDoc${SEP}${docPath}${SEP}current`);
    expect(k.resourceKeyHash).toBe(
      'd84e59a7436bcacb944be602131f70c5b7b5447f3659e5ac41c04ade316278de',
    );
  });

  it('pins a numeric revision distinctly from "current"', () => {
    const k = contentDocResourceKey(docPath, 7);
    expect(k.canonicalResourceKey).toBe(`${KEY}${SEP}contentDoc${SEP}${docPath}${SEP}7`);
    expect(k.resourceKeyHash).toBe(
      '20c3c86876f45e567b158ee6f82c409041fa21bfd443d2973872ffc0977ccbc6',
    );
  });

  it('resourceKeyHash is exactly sha256(canonicalResourceKey)', () => {
    const k = contentDocResourceKey(docPath, 'current');
    expect(resourceKeyHash(k.canonicalResourceKey)).toBe(k.resourceKeyHash);
  });
});

describe('storageObjectResourceKey', () => {
  it('builds the exact canonical string + hash', () => {
    const k = storageObjectResourceKey('my-bucket', 'uploads/a/b', 123);
    expect(k.resourceType).toBe('storageObject');
    expect(k.resourceId).toBe('my-bucket/uploads/a/b');
    expect(k.canonicalResourceKey).toBe(`${KEY}${SEP}storageObject${SEP}my-bucket${SEP}uploads/a/b${SEP}123`);
    expect(k.resourceKeyHash).toBe(
      '55e65ca5b3f4aae03a264dc3c61d6a13b1cbfab4808e03e41eb6a381d48677cd',
    );
  });
});

describe('mediaAssetResourceKeys', () => {
  it('returns only the asset key when there is no lineage', () => {
    const keys = mediaAssetResourceKeys({ mediaAssetId: 'asset_1' });
    expect(keys).toHaveLength(1);
    expect(keys[0].resourceType).toBe('mediaAsset');
    expect(keys[0].resourceId).toBe('asset_1');
    expect(keys[0].canonicalResourceKey).toBe(`${KEY}${SEP}mediaAsset${SEP}asset${SEP}asset_1`);
    expect(keys[0].resourceKeyHash).toBe(
      '7d901e509b5fd653393da3e8c591c13e9d7487ed1fe1b1677218a36acdd7d3c3',
    );
  });

  it('adds a SEPARATE rootIngest key (index 1) when originLineage.rootIngestId is present', () => {
    const keys = mediaAssetResourceKeys({
      mediaAssetId: 'asset_1',
      originLineage: {
        rootIngestId: 'root_9',
      } as never,
    });
    expect(keys).toHaveLength(2);
    expect(keys[1].resourceId).toBe('root_9');
    expect(keys[1].canonicalResourceKey).toBe(`${KEY}${SEP}mediaAsset${SEP}rootIngest${SEP}root_9`);
    expect(keys[1].resourceKeyHash).toBe(
      '8cb15fc86cd6282b12915d143de79e14d3495d41a8426c4ec96c9a47ec0021a9',
    );
  });

  it('the rootIngest key hashes IDENTICALLY to rootIngestResourceKey(sameId)', () => {
    const fromAsset = mediaAssetResourceKeys({
      mediaAssetId: 'asset_1',
      originLineage: { rootIngestId: 'root_9' } as never,
    })[1];
    const bare = rootIngestResourceKey('root_9');
    expect(bare.canonicalResourceKey).toBe(fromAsset.canonicalResourceKey);
    expect(bare.resourceKeyHash).toBe(fromAsset.resourceKeyHash);
  });
});

describe('chatMessageRangeResourceKey / channelResourceKey / accountResourceKey', () => {
  it('chatMessageRange builds the exact canonical string + hash', () => {
    const k = chatMessageRangeResourceKey('chan_1', 42);
    expect(k.resourceType).toBe('chatMessageRange');
    expect(k.resourceId).toBe('chan_1#42');
    expect(k.canonicalResourceKey).toBe(`${KEY}${SEP}chatMessageRange${SEP}chan_1${SEP}42`);
    expect(k.resourceKeyHash).toBe(
      '081c7f3a910b979eca13b05025038467f8b1e910389572a6feb7b98cd3f55dca',
    );
  });

  it('channel builds the exact canonical string + hash', () => {
    const k = channelResourceKey('chan_1');
    expect(k.canonicalResourceKey).toBe(`${KEY}${SEP}channel${SEP}chan_1`);
    expect(k.resourceKeyHash).toBe(
      'cf3e0143a52fad37d9c2caf7e6f7798eaa8b0b0142c6d1f9f21364ba41807049',
    );
  });

  it('account builds the exact canonical string + hash', () => {
    const k = accountResourceKey('user_1');
    expect(k.canonicalResourceKey).toBe(`${KEY}${SEP}account${SEP}user_1`);
    expect(k.resourceKeyHash).toBe(
      'e74fde6c90236cbff494db34e04a74b750259e76fa3c85b062b3959433a674bd',
    );
  });
});
