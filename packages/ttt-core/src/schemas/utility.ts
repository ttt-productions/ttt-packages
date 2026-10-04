import { z } from 'zod';
import {
  violationIdSchema,
  auditionIdSchema,
  auditionEntryIdSchema,
  commissionListingIdSchema,
  shortLinkIdSchema,
  adminDispatchIdSchema,
  hallItemIdSchema,
} from './atoms.js';
import { FEEDBACK_TYPES } from '../constants/business.js';
import { MAX_CURATED_PROFANITY_TERMS_PER_REQUEST } from '../constants/moderation.js';
import {
  APPEAL_MESSAGE_INPUT,
  CURATED_PROFANITY_TERM_INPUT,
  FEEDBACK_SUGGESTION_INPUT,
} from '../constants/text-fields.js';
import { textFieldSchema } from './text-field.js';

export const AcceptViolationDecisionInputSchema = z.object({
  violationId: violationIdSchema,
}).strict();
export type AcceptViolationDecisionInput = z.infer<typeof AcceptViolationDecisionInputSchema>;

// One member per `ShortLinkTargetTypeSchema` value (schemas/atoms.ts), each carrying exactly the
// id(s) its destination URL needs.

export const CreateShortLinkInputSchema = z.discriminatedUnion('targetType', [
  z.object({
    targetType: z.literal('audition'),
    auditionId: auditionIdSchema,
  }).strict(),
  z.object({
    targetType: z.literal('audition-entry'),
    auditionId: auditionIdSchema,
    auditionEntryId: auditionEntryIdSchema,
  }).strict(),
  z.object({
    targetType: z.literal('commission'),
    commissionListingId: commissionListingIdSchema,
  }).strict(),
  z.object({
    targetType: z.literal('hall-library-item'),
    hallItemId: hallItemIdSchema,
  }).strict(),
]);
export type CreateShortLinkInput = z.infer<typeof CreateShortLinkInputSchema>;

// No-input seed callables (Ready for Launch tab). Each prepopulates one system
// dataset from a canonical backend constant; the input is intentionally empty.
export const SeedProfanityListInputSchema = z.object({}).strict();
export type SeedProfanityListInput = z.infer<typeof SeedProfanityListInputSchema>;

export const SeedReservedUsernamesInputSchema = z.object({}).strict();
export type SeedReservedUsernamesInput = z.infer<typeof SeedReservedUsernamesInputSchema>;

export const SeedBlockedFranchiseNamesInputSchema = z.object({}).strict();
export type SeedBlockedFranchiseNamesInput = z.infer<typeof SeedBlockedFranchiseNamesInputSchema>;

// Public-document seed callables (Ready for Launch tab), one per PublicDocumentId. Each
// publishes its document's launch content as v1 through the public-document release owner,
// only while that document has never been published (otherwise a no-op). The input is
// intentionally empty.
export const SeedRulesAndAgreementsInputSchema = z.object({}).strict();
export type SeedRulesAndAgreementsInput = z.infer<typeof SeedRulesAndAgreementsInputSchema>;

export const SeedFuturePlansInputSchema = z.object({}).strict();
export type SeedFuturePlansInput = z.infer<typeof SeedFuturePlansInputSchema>;

export const SeedTermsPageInputSchema = z.object({}).strict();
export type SeedTermsPageInput = z.infer<typeof SeedTermsPageInputSchema>;

export const SeedPrivacyPageInputSchema = z.object({}).strict();
export type SeedPrivacyPageInput = z.infer<typeof SeedPrivacyPageInputSchema>;

export const SeedTakeItDownPageCopyInputSchema = z.object({}).strict();
export type SeedTakeItDownPageCopyInput = z.infer<typeof SeedTakeItDownPageCopyInputSchema>;

export const SeedDmcaPolicyInputSchema = z.object({}).strict();
export type SeedDmcaPolicyInput = z.infer<typeof SeedDmcaPolicyInputSchema>;

/** One curated word-list term. The published list is hashed with edge-protocol-core's
 *  `hashStringSet`, which joins terms with a line break and refuses a term holding one, so its
 *  declaration is single-line and a term with a line break is refused here rather than failing
 *  every later publish. */
const curatedProfanityTermSchema = textFieldSchema(CURATED_PROFANITY_TERM_INPUT);

/** Admin add/remove words on the self-owned curated profanity list (no external sync). */
export const CurateProfanityListInputSchema = z
  .object({
    add: z.array(curatedProfanityTermSchema).max(MAX_CURATED_PROFANITY_TERMS_PER_REQUEST).optional(),
    remove: z.array(curatedProfanityTermSchema).max(MAX_CURATED_PROFANITY_TERMS_PER_REQUEST).optional(),
  })
  .strict()
  .refine((v) => (v.add?.length ?? 0) + (v.remove?.length ?? 0) > 0, {
    message: 'Provide at least one word to add or remove.',
  });
export type CurateProfanityListInput = z.infer<typeof CurateProfanityListInputSchema>;

/** The `curateProfanityList` answer: the terms it added and removed, and the list's size after it.
 *  Non-strict (server → client result posture). */
export const CurateProfanityListResultSchema = z.object({
  success: z.literal(true),
  added: z.array(z.string()),
  removed: z.array(z.string()),
  wordCount: z.number().int().nonnegative(),
});
export type CurateProfanityListResult = z.infer<typeof CurateProfanityListResultSchema>;

export const SubmitContentAppealInputSchema = z.object({
  violationId: violationIdSchema,
  appealMessage: textFieldSchema(APPEAL_MESSAGE_INPUT),
}).strict();
export type SubmitContentAppealInput = z.infer<typeof SubmitContentAppealInputSchema>;

export const SubmitFeedbackInputSchema = z.object({
  feedbackType: z.enum(FEEDBACK_TYPES),
  // Stored lowercase, so "Dark" and "dark" are one suggestion.
  suggestion: textFieldSchema(FEEDBACK_SUGGESTION_INPUT).transform((word) => word.toLowerCase()),
}).strict();
export type SubmitFeedbackInput = z.infer<typeof SubmitFeedbackInputSchema>;

export const TrackShortLinkClickInputSchema = z.object({
  shortId: shortLinkIdSchema.max(64),
}).strict();
export type TrackShortLinkClickInput = z.infer<typeof TrackShortLinkClickInputSchema>;

// The caller marks the thread seen through the newest message it has on screen. The server
// moves the caller's OWN marker (AdminDispatchReadMarkerSchema) to that time, never past the
// thread's latest message and never backwards, so a message that arrived after the screen
// rendered stays unseen.
export const MarkAdminDispatchReadInputSchema = z.object({
  adminDispatchId: adminDispatchIdSchema.max(128),
  seenThroughMessageAt: z.number().int().nonnegative(),
}).strict();
export type MarkAdminDispatchReadInput = z.infer<typeof MarkAdminDispatchReadInputSchema>;

// --- Authoritative mutation RESULTS (non-strict server → client posture) ---

/** The caller's committed marker — the client patches its cached thread rows from it. */
export const MarkAdminDispatchReadResultSchema = z.object({
  success: z.literal(true),
  adminDispatchId: adminDispatchIdSchema,
  lastSeenMessageAt: z.number().int().nonnegative(),
});
export type MarkAdminDispatchReadResult = z.infer<typeof MarkAdminDispatchReadResultSchema>;

// submitContentAppeal — the transaction sets appealStatus 'pending' + appealedAt = now on
// the violation; both are known at commit and let the client patch its violations list.
export const SubmitContentAppealResultSchema = z.object({
  success: z.literal(true),
  violationId: violationIdSchema,
  /** The violation's appeal state after commit. */
  appealStatus: z.literal('pending'),
  appealedAt: z.number(),
  /** Operation-receipt audit id — the `content.appealSubmitted` event written in the same
   * transaction. Optional/additive; the domain id (`violationId`) is already carried above. */
  auditEventId: z.string().min(1).optional(),
});
export type SubmitContentAppealResult = z.infer<typeof SubmitContentAppealResultSchema>;

// acceptViolationDecision — the violation record (and its pendingMedia/archive docs) are
// removed at commit; the client drops the row from its violation + pendingMedia caches.
export const AcceptViolationDecisionResultSchema = z.object({
  success: z.literal(true),
  violationId: violationIdSchema,
  /** True when the record was already gone (idempotent accept). */
  alreadyRemoved: z.boolean(),
  /** Operation-receipt audit id — the `content.violationAccepted` event written in the same
   * transaction. Optional/additive; the domain id (`violationId`) is already carried above. */
  auditEventId: z.string().min(1).optional(),
});
export type AcceptViolationDecisionResult = z.infer<typeof AcceptViolationDecisionResultSchema>;

