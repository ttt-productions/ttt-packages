import { describe, it, expect } from 'vitest';
import {
  PHOTODNA_COVERAGE_MATRIX,
  requiredPhotoDnaBranchesForOrigin,
  runtimePhotoDnaBranchForDetectedKind,
  type PhotoDnaRequiredBranch,
} from '../src/media/photodna-coverage.js';
import { TTT_MEDIA_SPECS } from '../src/media/ttt-media-specs.js';
import { FileOriginSchema } from '../src/media/file-origin.js';
import type { MediaKind } from '@ttt-productions/media-schemas';

// CI coverage gate for the frozen Trust & Safety spec, Appendix A §A10
// (Finding-M3); durable design owner: ttt-prod
// docs/design/csam-detection-and-response.md. The
// matrix is DERIVED from TTT_MEDIA_SPECS[origin].accept.kinds — these tests fail
// if any origin is missing from the matrix, or if any accepted kind on any
// origin has no corresponding required PhotoDNA / spoof-guard branch (so a newly
// accepted kind fails CI until covered).

// The §A10 kind → required-branch mapping, stated independently here so the test
// is an EXTERNAL check on the module rather than a tautology.
const EXPECTED_BRANCH_BY_KIND: Record<'image' | 'video' | 'audio', PhotoDnaRequiredBranch> = {
  image: 'imagePhotoDna',
  video: 'videoFramePhotoDna',
  audio: 'audioSpoofGuard',
};

// Canonical image → video → audio order, matching the module's deterministic output.
const CANONICAL_KIND_ORDER: Array<'image' | 'video' | 'audio'> = ['image', 'video', 'audio'];

describe('PhotoDNA coverage matrix (§A10)', () => {
  const origins = FileOriginSchema.options;

  it('every FileOriginSchema.options value is present in the matrix (no missing/extra)', () => {
    const matrixKeys = Object.keys(PHOTODNA_COVERAGE_MATRIX).sort();
    expect(matrixKeys).toEqual([...origins].sort());
  });

  for (const origin of origins) {
    describe(`origin: ${origin}`, () => {
      const acceptKinds = TTT_MEDIA_SPECS[origin].accept?.kinds ?? [];

      it('records the authoritative accept.kinds (not the mislabeled top-level spec.kind)', () => {
        expect(PHOTODNA_COVERAGE_MATRIX[origin].acceptedKinds).toEqual(acceptKinds);
      });

      it('required branches EXACTLY match the accept.kinds → branch mapping', () => {
        // Independently derive the expected branches from accept.kinds in
        // canonical order — the §A10 algorithm. 'file' has no branch.
        const expected = CANONICAL_KIND_ORDER.filter((k) =>
          (acceptKinds as MediaKind[]).includes(k),
        ).map((k) => EXPECTED_BRANCH_BY_KIND[k]);

        expect(requiredPhotoDnaBranchesForOrigin(origin)).toEqual(expected);
        expect([...PHOTODNA_COVERAGE_MATRIX[origin].requiredBranches]).toEqual(expected);
      });

      it('every accepted PhotoDNA-relevant kind has a corresponding required branch (fails CI for a new uncovered kind)', () => {
        const branches = new Set(requiredPhotoDnaBranchesForOrigin(origin));
        for (const kind of acceptKinds) {
          if (kind === 'file') continue; // generic kind has no PhotoDNA branch by design
          const branch = EXPECTED_BRANCH_BY_KIND[kind as 'image' | 'video' | 'audio'];
          expect(
            branch,
            `${origin} accepts '${kind}' but §A10 defines no required branch for it`,
          ).toBeDefined();
          expect(
            branches.has(branch),
            `${origin} accepts '${kind}' but the matrix is missing its '${branch}' branch`,
          ).toBe(true);
        }
      });
    });
  }
});

describe('runtimePhotoDnaBranchForDetectedKind (§A10 runtime dispatch)', () => {
  it('routes each detected kind to its branch', () => {
    expect(runtimePhotoDnaBranchForDetectedKind('image')).toBe('imagePhotoDna');
    expect(runtimePhotoDnaBranchForDetectedKind('video')).toBe('videoFramePhotoDna');
    expect(runtimePhotoDnaBranchForDetectedKind('audio')).toBe('audioSpoofGuard');
  });

  it('returns null for the generic file kind (no PhotoDNA path — caller rejects)', () => {
    expect(runtimePhotoDnaBranchForDetectedKind('file')).toBeNull();
  });
});
