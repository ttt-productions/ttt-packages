import { describe, it, expect } from 'vitest';
import { TTT_MEDIA_SPECS } from '../src/media/ttt-media-specs.js';
import { MediaVariantKeySchema } from '../src/doc-schemas/media-assets.js';

// Appendix A0 — `MEDIA_VARIANT_KEYS` / MediaVariantKeySchema (doc-schemas/media-assets.ts)
// is the ONE declaration of the variant-key set. The `key` values inside TTT_MEDIA_SPECS
// are USAGES of that set; the generic MediaOriginSpec types them as open strings (a
// compile-link through the generic package fights TS contextual typing), so this test is
// the CI enforcement that every usage derives from the one declaration:
//   1. every declared `image.variants[].key` parses against MediaVariantKeySchema
//      (an undeclared variant name fails CI until added to MEDIA_VARIANT_KEYS), and
//   2. every schema member is actually declared by some origin (no dead enum value —
//      an untypable variantSha256s key nothing ever produces).

function declaredImageVariantKeys(): Set<string> {
  const keys = new Set<string>();
  for (const spec of Object.values(TTT_MEDIA_SPECS)) {
    for (const variant of spec.processing?.image?.image?.variants ?? []) {
      keys.add(variant.key);
    }
  }
  return keys;
}

describe('TTT_MEDIA_SPECS variant keys derive from the ONE MEDIA_VARIANT_KEYS declaration', () => {
  it('every declared variant key parses against MediaVariantKeySchema', () => {
    for (const key of declaredImageVariantKeys()) {
      expect(
        MediaVariantKeySchema.safeParse(key).success,
        `declared variant key '${key}' is not a member of MEDIA_VARIANT_KEYS — add it to the ONE declaration (doc-schemas/media-assets.ts)`,
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
