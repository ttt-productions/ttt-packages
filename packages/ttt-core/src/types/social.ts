// Social types: SquareStreetz feed, Mentions, Follows. (Pledge-payment types live in
// ../types/payments.ts.)
export type { Mention, MentionType } from '../media/atoms.js';

// --- SquareStreetz Social Media ---
// SquareStreetz post/mention-history/follow shapes — plus SquareStreetzPostPayload (the
// create/announcement transport shape, inferred from SquareStreetzPostPayloadSchema) — are
// the single source of truth in ../doc-schemas/social.ts and re-exported below. The
// frontend extends SquareStreetzPostPayload with a local `mediaFile?: File`.

export type {
  SquareStreetzPostType,
  SquareStreetzPost,
  SquareStreetzPostPayload,
  MentionHistoryItem,
  MentionHistoryDocument,
  FollowEdge,
  FollowCounter,
} from '../doc-schemas/social.js';
