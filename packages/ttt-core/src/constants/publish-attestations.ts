// ============================================================================
// HALL-PUBLISH ATTESTATION COPY — the ONE home for the consistent-format
// attestation wording (ARCH-102, extended 2026-07-13; consolidated from the
// former component-local map in ttt-prod publish-attestations.tsx). The
// attestation carries a Work-type-specific example using the Work's own unit
// word; the publish flow always knows the type.
// ============================================================================

import type { WorkProjectType } from '../types/content.js';

export const CONSISTENT_FORMAT_WORDING: Record<WorkProjectType, string> = {
  Tales:
    'All items in this Work are the same kind of thing — a consistent format throughout. If chapter 1 is a short story, then all chapters are short stories.',
  Tunes:
    'All items in this Work are the same kind of thing — a consistent format throughout. If track 1 is a podcast, then all tracks are podcasts.',
  Television:
    'All items in this Work are the same kind of thing — a consistent format throughout. If episode 1 is a clip show, then all episodes are clip shows.',
};
