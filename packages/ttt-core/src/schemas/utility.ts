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
import { FEEDBACK_TYPES } from '../constants/business-admin.js';
import { MAX_CURATED_PROFANITY_TERMS_PER_REQUEST } from '../constants/moderation.js';
import {
  APPEAL_MESSAGE_INPUT,
  CURATED_PROFANITY_TERM_INPUT,
  FEEDBACK_SUGGESTION_INPUT,
} from '../constants/text-fields.js';
import { textFieldSchema } from './text-field.js';

export const AcceptViolationDecisionInputSchema = z
  .object({
    violationId: violationIdSchema,
  })
  .strict();
export type AcceptViolationDecisionInput = z.infer<typeof AcceptViolationDecisionInputSchema>;

export const CreateShortLinkInputSchema = z.discriminatedUnion('targetType', [
  z
    .object({
      targetType: z.literal('audition'),
      auditionId: auditionIdSchema,
    })
    .strict(),
  z
    .object({
      targetType: z.literal('audition-entry'),
      auditionId: auditionIdSchema,
      auditionEntryId: auditionEntryIdSchema,
    })
    .strict(),
  z
    .object({
      targetType: z.literal('commission'),
      commissionListingId: commissionListingIdSchema,
    })
    .strict(),
  z
    .object({
      targetType: z.literal('hall-library-item'),
      hallItemId: hallItemIdSchema,
    })
    .strict(),
]);
export type CreateShortLinkInput = z.infer<typeof CreateShortLinkInputSchema>;

export const CreateShortLinkResultSchema = z.object({
  shortId: shortLinkIdSchema,
  shortUrl: z.string().min(1),
});
export type CreateShortLinkResult = z.infer<typeof CreateShortLinkResultSchema>;

export const SeedProfanityListInputSchema = z.object({}).strict();
export type SeedProfanityListInput = z.infer<typeof SeedProfanityListInputSchema>;

export const SeedProfanityListResultSchema = z.object({
  success: z.literal(true),
  alreadySeeded: z.boolean(),
  wordCount: z.number().int().nonnegative(),
});
export type SeedProfanityListResult = z.infer<typeof SeedProfanityListResultSchema>;

export const SeedReservedUsernamesInputSchema = z.object({}).strict();
export type SeedReservedUsernamesInput = z.infer<typeof SeedReservedUsernamesInputSchema>;

export const SeedReservedUsernamesResultSchema = z.object({
  success: z.literal(true),
  added: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type SeedReservedUsernamesResult = z.infer<typeof SeedReservedUsernamesResultSchema>;

export const SeedBlockedFranchiseNamesInputSchema = z.object({}).strict();
export type SeedBlockedFranchiseNamesInput = z.infer<typeof SeedBlockedFranchiseNamesInputSchema>;

export const SeedBlockedFranchiseNamesResultSchema = z.object({
  success: z.literal(true),
  added: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type SeedBlockedFranchiseNamesResult = z.infer<typeof SeedBlockedFranchiseNamesResultSchema>;

export const SeedRulesAndAgreementsInputSchema = z.object({}).strict();
export type SeedRulesAndAgreementsInput = z.infer<typeof SeedRulesAndAgreementsInputSchema>;

export const SeedFuturePlansInputSchema = z.object({}).strict();
export type SeedFuturePlansInput = z.infer<typeof SeedFuturePlansInputSchema>;

export const SeedTermsPageInputSchema = z.object({}).strict();
export type SeedTermsPageInput = z.infer<typeof SeedTermsPageInputSchema>;

export const SeedPublicDocumentResultSchema = z.object({
  success: z.literal(true),
  seeded: z.boolean(),
  version: z.number().int().positive(),
});
export type SeedPublicDocumentResult = z.infer<typeof SeedPublicDocumentResultSchema>;

export const SeedPrivacyPageInputSchema = z.object({}).strict();
export type SeedPrivacyPageInput = z.infer<typeof SeedPrivacyPageInputSchema>;

export const SeedTakeItDownPageCopyInputSchema = z.object({}).strict();
export type SeedTakeItDownPageCopyInput = z.infer<typeof SeedTakeItDownPageCopyInputSchema>;

export const SeedDmcaPolicyInputSchema = z.object({}).strict();
export type SeedDmcaPolicyInput = z.infer<typeof SeedDmcaPolicyInputSchema>;

// edge-protocol-core's `hashStringSet` joins terms with a line break and refuses a term holding
// one, so such a term is refused here rather than failing every later publish.
const curatedProfanityTermSchema = textFieldSchema(CURATED_PROFANITY_TERM_INPUT);

export const CurateProfanityListInputSchema = z
  .object({
    add: z
      .array(curatedProfanityTermSchema)
      .max(MAX_CURATED_PROFANITY_TERMS_PER_REQUEST)
      .optional(),
    remove: z
      .array(curatedProfanityTermSchema)
      .max(MAX_CURATED_PROFANITY_TERMS_PER_REQUEST)
      .optional(),
  })
  .strict()
  .refine((v) => (v.add?.length ?? 0) + (v.remove?.length ?? 0) > 0, {
    message: 'Provide at least one word to add or remove.',
  });
export type CurateProfanityListInput = z.infer<typeof CurateProfanityListInputSchema>;

export const CurateProfanityListResultSchema = z.object({
  success: z.literal(true),
  added: z.array(z.string()),
  removed: z.array(z.string()),
  wordCount: z.number().int().nonnegative(),
});
export type CurateProfanityListResult = z.infer<typeof CurateProfanityListResultSchema>;

export const SubmitContentAppealInputSchema = z
  .object({
    violationId: violationIdSchema,
    appealMessage: textFieldSchema(APPEAL_MESSAGE_INPUT),
  })
  .strict();
export type SubmitContentAppealInput = z.infer<typeof SubmitContentAppealInputSchema>;

export const SubmitFeedbackInputSchema = z
  .object({
    feedbackType: z.enum(FEEDBACK_TYPES),
    suggestion: textFieldSchema(FEEDBACK_SUGGESTION_INPUT).transform((word) => word.toLowerCase()),
  })
  .strict();
export type SubmitFeedbackInput = z.infer<typeof SubmitFeedbackInputSchema>;

export const SubmitFeedbackResultSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});
export type SubmitFeedbackResult = z.infer<typeof SubmitFeedbackResultSchema>;

export const TrackShortLinkClickInputSchema = z
  .object({
    shortId: shortLinkIdSchema.max(64),
  })
  .strict();
export type TrackShortLinkClickInput = z.infer<typeof TrackShortLinkClickInputSchema>;

export const TrackShortLinkClickResultSchema = z.object({
  success: z.literal(true),
  destinationUrl: z.string().min(1),
});
export type TrackShortLinkClickResult = z.infer<typeof TrackShortLinkClickResultSchema>;

export const MarkAdminDispatchReadInputSchema = z
  .object({
    adminDispatchId: adminDispatchIdSchema.max(128),
    seenThroughMessageAt: z.number().int().nonnegative(),
  })
  .strict();
export type MarkAdminDispatchReadInput = z.infer<typeof MarkAdminDispatchReadInputSchema>;

export const MarkAdminDispatchReadResultSchema = z.object({
  success: z.literal(true),
  adminDispatchId: adminDispatchIdSchema,
  lastSeenMessageAt: z.number().int().nonnegative(),
});
export type MarkAdminDispatchReadResult = z.infer<typeof MarkAdminDispatchReadResultSchema>;

export const SubmitContentAppealResultSchema = z.object({
  success: z.literal(true),
  violationId: violationIdSchema,
  appealStatus: z.literal('pending'),
  appealedAt: z.number(),
  auditEventId: z.string().min(1).optional(),
});
export type SubmitContentAppealResult = z.infer<typeof SubmitContentAppealResultSchema>;

export const AcceptViolationDecisionResultSchema = z.object({
  success: z.literal(true),
  violationId: violationIdSchema,
  alreadyRemoved: z.boolean(),
  auditEventId: z.string().min(1).optional(),
});
export type AcceptViolationDecisionResult = z.infer<typeof AcceptViolationDecisionResultSchema>;
