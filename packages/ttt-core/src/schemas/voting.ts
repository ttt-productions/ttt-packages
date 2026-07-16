import { z } from 'zod';
import { auditionIdSchema, auditionEntryIdSchema } from './atoms.js';

export const VoteForAuditionEntryInputSchema = z.object({
  auditionId: auditionIdSchema,
  newVote: z.object({
    auditionEntryId: auditionEntryIdSchema,
  }).strict(),
  // Accepted for backwards compatibility but ignored server-side; see runtime comment below.
  currentVoteId: z.string().nullable().optional(),
}).strict();
export type VoteForAuditionEntryInput = z.infer<typeof VoteForAuditionEntryInputSchema>;

/**
 * Authoritative result of voteForAuditionEntry — the committed final vote state the
 * transaction already knows (it READS both entry docs: the new entry for the
 * existence/hidden checks, and on a vote switch the old entry for the clamped
 * decrement — so both committed counts cost no extra read; the like/unlike precedent).
 *
 * This callable only CASTS or MOVES a vote — there is no unvote path (the input
 * requires `newVote.auditionEntryId`; `currentVoteId` is ignored server-side), so
 * `isVoted` is always true.
 *
 * Path semantics:
 * - First vote: `alreadyVoted: false`, `voteCount` = read count + 1,
 *   `previousAuditionEntryId: null`, no `previousVoteCount`.
 * - Vote switch: `alreadyVoted: false`, `voteCount` = read count + 1,
 *   `previousAuditionEntryId` = the entry the vote moved off; `previousVoteCount` =
 *   its clamped post-decrement count — ABSENT when that entry no longer exists
 *   (deleted entries skip the decrement).
 * - Idempotent no-op (already voting for this entry): `alreadyVoted: true`,
 *   `voteCount` = the UNCHANGED read count, `previousAuditionEntryId: null`.
 *
 * Non-strict (server → client result posture).
 */
export const VoteForAuditionEntryResultSchema = z.object({
  success: z.literal(true),
  auditionId: auditionIdSchema,
  /** The entry the caller's vote now rests on. */
  auditionEntryId: auditionEntryIdSchema,
  /** Final caller vote-state — always true; this callable never removes a vote. */
  isVoted: z.literal(true),
  /** True when the caller was already voting for this entry (idempotent no-op). */
  alreadyVoted: z.boolean(),
  /** Committed vote count of the voted entry. */
  voteCount: z.number().int().nonnegative(),
  /** Entry the vote moved OFF on a switch; null on a first vote or idempotent no-op. */
  previousAuditionEntryId: auditionEntryIdSchema.nullable(),
  /** Committed post-decrement count of the previous entry — absent when
   * previousAuditionEntryId is null or that entry was deleted (no decrement applied). */
  previousVoteCount: z.number().int().nonnegative().optional(),
});
export type VoteForAuditionEntryResult = z.infer<typeof VoteForAuditionEntryResultSchema>;


