import { describe, it, expect } from 'vitest';
import { TTT_MEDIA_SPECS } from '../src/media/ttt-media-specs.js';
import { MediaVariantKeySchema } from '../src/doc-schemas/media-assets.js';
import { MEDIA_PIPELINE_OUTPUT_KEYS } from '@ttt-productions/media-schemas';

// `MEDIA_VARIANT_KEYS` / MediaVariantKeySchema (doc-schemas/media-assets.ts) is the ONE
// declaration of the variant-key set. The `key` values inside TTT_MEDIA_SPECS are USAGES of
// that set; the generic MediaOriginSpec types them as open strings (a compile-link through the
// generic package fights TS contextual typing), so this guard enforces that every usage derives
// from the one declaration and that the set names nothing the pipeline never writes.

function declaredImageVariantKeys(): Set<string> {
  const keys = new Set<string>();
  for (const spec of Object.values(TTT_MEDIA_SPECS)) {
    for (const variant of spec.processing?.image?.image?.variants ?? []) {
      keys.add(variant.key);
    }
  }
  return keys;
}

function producedVariantKeys(): Set<string> {
  const keys = declaredImageVariantKeys();
  for (const spec of Object.values(TTT_MEDIA_SPECS)) {
    if (spec.processing?.video) MEDIA_PIPELINE_OUTPUT_KEYS.video.forEach((key) => keys.add(key));
    if (spec.processing?.audio) MEDIA_PIPELINE_OUTPUT_KEYS.audio.forEach((key) => keys.add(key));
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

  it('every MediaVariantKeySchema member is produced by some origin', () => {
    const produced = producedVariantKeys();
    for (const key of MediaVariantKeySchema.options) {
      expect(
        produced.has(key),
        `MediaVariantKeySchema member '${key}' is produced by no origin (dead enum value)`,
      ).toBe(true);
    }
  });

  it('every key a video or audio origin writes is a canonical variant key', () => {
    for (const key of [...MEDIA_PIPELINE_OUTPUT_KEYS.video, ...MEDIA_PIPELINE_OUTPUT_KEYS.audio]) {
      expect(MediaVariantKeySchema.safeParse(key).success).toBe(true);
    }
  });

  it('every image processing spec declares its variants, so the pipeline never falls back to an unnamed original', () => {
    for (const [origin, spec] of Object.entries(TTT_MEDIA_SPECS)) {
      const image = spec.processing?.image;
      if (!image) continue;
      expect(image.image?.variants?.length ?? 0, `${origin} image spec declares no variants`).toBeGreaterThan(0);
    }
  });
});
