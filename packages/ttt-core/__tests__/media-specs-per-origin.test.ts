import { describe, it, expect } from 'vitest';
import { TTT_MEDIA_SPECS } from '../src/media/ttt-media-specs.js';
import { FileOriginSchema } from '../src/media/file-origin.js';

// Per-origin correctness of the TTT media-spec registry. The Record<FileOrigin, …>
// type already forces one entry per origin at compile time; these runtime checks
// catch shape drift TypeScript can't (a processing branch missing for an accepted
// kind, a capture mode enabled for a kind the origin doesn't accept, a zero cap).
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

      it('has a processing branch for every accepted kind', () => {
        for (const kind of spec.accept?.kinds ?? []) {
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
