import { describe, it, expect } from 'vitest';
import { TTT_MEDIA_SPECS } from '../src/media/ttt-media-specs.js';
import { FileOriginSchema } from '../src/media/file-origin.js';
import { NCII_EVIDENCE_MAX_FILE_BYTES } from '../src/doc-schemas/ncii/config.js';

describe('TTT_MEDIA_SPECS per-origin correctness', () => {
  const origins = FileOriginSchema.options;

  it('registry keys exactly match FileOriginSchema (no missing/extra origin)', () => {
    const specKeys = Object.keys(TTT_MEDIA_SPECS).sort();
    expect(specKeys).toEqual([...origins].sort());
  });

  for (const origin of origins) {
    const spec = TTT_MEDIA_SPECS[origin];

    describe(`spec: ${origin}`, () => {
      it('declares a positive maxBytes', () => {
        expect(spec.maxBytes).toBeGreaterThan(0);
      });

      it('accepts at least one media kind', () => {
        expect(spec.accept?.kinds?.length ?? 0).toBeGreaterThan(0);
      });

      it('has a processing branch for every accepted kind (unless preserveOriginal)', () => {
        if (spec.preserveOriginal === true) return;
        for (const kind of spec.accept?.kinds ?? []) {
          if (kind === 'file') continue;
          expect(
            spec.processing?.[kind],
            `${origin} accepts '${kind}' but has no processing.${kind}`,
          ).toBeDefined();
        }
      });

      it('only enables capture modes consistent with accepted kinds', () => {
        const kinds = new Set(spec.accept?.kinds ?? []);
        if (spec.client?.allowCapturePhoto) expect(kinds.has('image')).toBe(true);
        if (spec.client?.allowRecordVideo) expect(kinds.has('video')).toBe(true);
        if (spec.client?.allowRecordAudio) expect(kinds.has('audio')).toBe(true);
      });
    });
  }
});

describe('the NCII evidence upload cap', () => {
  it('is the NCII per-file cap — one owner, never a second number', () => {
    expect(TTT_MEDIA_SPECS['ncii-evidence'].maxBytes).toBe(NCII_EVIDENCE_MAX_FILE_BYTES);
  });
});
