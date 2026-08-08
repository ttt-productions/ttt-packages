import { describe, it, expect } from 'vitest';
import {
  buildMediaAssetKey,
  buildMediaAssetKeyPrefix,
} from '../src/media/media-asset-url';

describe('buildMediaAssetKeyPrefix', () => {
  it('builds the prefix owning every variant of one asset', () => {
    expect(buildMediaAssetKeyPrefix('asset_abc')).toBe('mediaAssets/asset_abc');
  });

  it('carries no trailing slash (callers append their own separator)', () => {
    expect(buildMediaAssetKeyPrefix('asset_abc').endsWith('/')).toBe(false);
  });
});

describe('buildMediaAssetKey', () => {
  it('builds the object key for a variant', () => {
    expect(buildMediaAssetKey('asset_abc', 'main')).toBe('mediaAssets/asset_abc/main');
    expect(buildMediaAssetKey('asset_xyz', 'full')).toBe('mediaAssets/asset_xyz/full');
  });

  it('derives from the prefix so the mediaAssets/ literal has one owner', () => {
    expect(buildMediaAssetKey('asset_abc', 'main')).toBe(
      `${buildMediaAssetKeyPrefix('asset_abc')}/main`
    );
  });
});
