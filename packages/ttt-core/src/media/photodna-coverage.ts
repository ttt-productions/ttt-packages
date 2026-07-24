// PhotoDNA coverage matrix (frozen Trust & Safety spec, Appendix A §A10 —
// Finding-M3, decision-free algorithm; durable design owner: ttt-prod
// docs/design/csam-detection-and-response.md). The CI coverage test and the
// runtime router are BOTH derived from this module so they cannot drift from
// `TTT_MEDIA_SPECS`.
//
// The source of truth for what a media origin accepts is
// `TTT_MEDIA_SPECS[origin].accept.kinds`, NOT the top-level `spec.kind` (which
// mislabels `craft-skill-media`/`squareStreetz` as 'image' and
// `guild-chat-message-attachment`/`work-asset` as 'generic', although all four
// accept image+video+audio). Nothing here is hard-coded per-origin — every entry
// is computed from the registry, so a new accepted kind on any origin fails CI
// (via photodna-coverage.test.ts) until a branch covers it.

import type { MediaKind } from '@ttt-productions/media-schemas';
import { FileOriginSchema, type FileOrigin } from './file-origin.js';
import { TTT_MEDIA_SPECS } from './ttt-media-specs.js';

/**
 * The required pre-publication PhotoDNA / spoof-guard branch implied by an
 * accepted (or, at runtime, magic-byte-detected) media kind:
 *  - 'image'  ⇒ image PhotoDNA (pre-publication, fail-closed)
 *  - 'video'  ⇒ frame-extraction (keyframes / ~1fps, capped) → PhotoDNA every frame
 *  - 'audio'  ⇒ AUDIO-ONLY SPOOF GUARD: confirm the bytes are genuinely audio
 *               (a non-audio payload on an audio path is rejected, not skipped).
 *               Audio is NOT image/video hashed.
 */
export type PhotoDnaRequiredBranch =
  | 'imagePhotoDna'
  | 'videoFramePhotoDna'
  | 'audioSpoofGuard';

/**
 * The PhotoDNA-relevant subset of `MediaKind`. The generic 'file' kind has no
 * PhotoDNA / spoof-guard branch and never appears in any TTT origin's
 * `accept.kinds`, so it is excluded from the §A10 mapping.
 */
type PhotoDnaCoveredKind = Extract<MediaKind, 'image' | 'video' | 'audio'>;

/**
 * The §A10 kind → required-branch mapping. This is the ONLY place the
 * kind↔branch correspondence is written; both the build-time matrix and the
 * runtime router derive from it. A newly accepted PhotoDNA-relevant kind must be
 * added here to compile (the `Record` is total over `PhotoDnaCoveredKind`).
 */
const REQUIRED_BRANCH_BY_KIND: Record<PhotoDnaCoveredKind, PhotoDnaRequiredBranch> = {
  image: 'imagePhotoDna',
  video: 'videoFramePhotoDna',
  audio: 'audioSpoofGuard',
};

const PHOTODNA_COVERED_KINDS = Object.keys(
  REQUIRED_BRANCH_BY_KIND,
) as PhotoDnaCoveredKind[];

function isPhotoDnaCoveredKind(kind: MediaKind): kind is PhotoDnaCoveredKind {
  return (PHOTODNA_COVERED_KINDS as MediaKind[]).includes(kind);
}

/** The authoritative accepted-kinds set for an origin (`accept.kinds`). */
function acceptedKindsForOrigin(origin: FileOrigin): MediaKind[] {
  return TTT_MEDIA_SPECS[origin].accept?.kinds ?? [];
}

/**
 * The required PhotoDNA / spoof-guard branches for an origin, derived from its
 * `accept.kinds` per the §A10 algorithm. Deduped, in
 * image → video → audio canonical order. Pure / decision-free.
 */
export function requiredPhotoDnaBranchesForOrigin(
  origin: FileOrigin,
): PhotoDnaRequiredBranch[] {
  const kinds = new Set(acceptedKindsForOrigin(origin));
  // Iterate the canonical kind order (not the registry array order) so output is
  // deterministic regardless of how an origin lists its accepted kinds.
  return PHOTODNA_COVERED_KINDS.filter((kind) => kinds.has(kind)).map(
    (kind) => REQUIRED_BRANCH_BY_KIND[kind],
  );
}

/** One row of the derived build-time coverage matrix. */
export interface PhotoDnaCoverageEntry {
  /** The authoritative accepted-kinds set (`TTT_MEDIA_SPECS[origin].accept.kinds`). */
  readonly acceptedKinds: readonly MediaKind[];
  /** The required pre-publication branches implied by `acceptedKinds`. */
  readonly requiredBranches: readonly PhotoDnaRequiredBranch[];
}

/**
 * The build-time / CI coverage matrix: every `FileOriginSchema.options` value
 * mapped to its accepted kinds + required PhotoDNA branches. Derived from
 * `TTT_MEDIA_SPECS` at module load — never hand-maintained. `photodna-coverage.test.ts`
 * fails CI if any origin is missing OR any accepted kind has no required branch.
 */
export const PHOTODNA_COVERAGE_MATRIX: Record<FileOrigin, PhotoDnaCoverageEntry> =
  FileOriginSchema.options.reduce((matrix, origin) => {
    matrix[origin] = {
      acceptedKinds: acceptedKindsForOrigin(origin),
      requiredBranches: requiredPhotoDnaBranchesForOrigin(origin),
    };
    return matrix;
  }, {} as Record<FileOrigin, PhotoDnaCoverageEntry>);

/**
 * Runtime dispatch (per uploaded object). `serverKind` is the SERVER-DETECTED
 * magic-byte kind — NEVER the client MIME / display kind — and MUST be a member
 * of `TTT_MEDIA_SPECS[origin].accept.kinds` for the upload's origin; a kind
 * outside that set is a spoof and the caller rejects (this helper does not see
 * the origin — the `accept.kinds ∋ serverKind` assertion is the caller's gate,
 * per §A10). For a covered kind it returns the branch the object must traverse:
 *   image → imagePhotoDna, video → videoFramePhotoDna, audio → audioSpoofGuard.
 *
 * Returns `null` for the generic 'file' kind (no PhotoDNA path); callers treat a
 * `null` here on a non-'file' detection as a hard reject, never a skip.
 */
export function runtimePhotoDnaBranchForDetectedKind(
  serverKind: MediaKind,
): PhotoDnaRequiredBranch | null {
  return isPhotoDnaCoveredKind(serverKind)
    ? REQUIRED_BRANCH_BY_KIND[serverKind]
    : null;
}
