import { describe, it, expect } from 'vitest';
import { TTT_MEDIA_SPECS } from '../src/media/ttt-media-specs.js';
import { MediaVariantKeySchema } from '../src/doc-schemas/media-assets.js';

// CI sync gate (Appendix A0): MediaVariantKeySchema must exactly equal the set of
// declared `image.variants[].key` values across every TTT_MEDIA_SPECS origin. The
// processing pipeline produces one hash per declared variant into
// MediaOriginLineageV1.variantSha256s (a `record(MediaVariantKeySchema, …)`), so a
// declared variant key with no schema member would be an untyped hash key, and a
// schema member with no declared variant would be dead. This test fails if a new
// variant key is declared but missing from MediaVariantKeySchema, or vice-versa.

function declaredImageVariantKeys(): Set<string> {
  const keys = new Set<string>();
  for (const spec of Object.values(TTT_MEDIA_SPECS)) {
    for (const variant of spec.processing?.image?.image?.variants ?? []) {
      keys.add(variant.key);
    }
  }
  return keys;
}

describe('MediaVariantKeySchema ↔ declared image.variants[].key sync', () => {
  it('schema values exactly equal the declared variant-key set across all origins', () => {
    const declared = [...declaredImageVariantKeys()].sort();
    const schema = [...MediaVariantKeySchema.options].sort();
    expect(schema).toEqual(declared);
  });

  it('every declared variant key parses against MediaVariantKeySchema', () => {
    for (const key of declaredImageVariantKeys()) {
      expect(
        MediaVariantKeySchema.safeParse(key).success,
        `declared variant key '${key}' is not a member of MediaVariantKeySchema`,
      ).toBe(true);
    }
  });

  it('every MediaVariantKeySchema member is actually declared by some origin', () => {
    const declared = declaredImageVariantKeys();
    for (const key of MediaVariantKeySchema.options) {
      expect(
        declared.has(key),
        `MediaVariantKeySchema member '${key}' is declared by no origin (dead enum value)`,
      ).toBe(true);
    }
  });
});
