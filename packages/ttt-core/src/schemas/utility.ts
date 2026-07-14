import { z } from 'zod';
import {
  violationIdSchema,
  auditionIdSchema,
  auditionEntryIdSchema,
  commissionListingIdSchema,
} from './atoms.js';
import { MAX_APPEAL_MESSAGE_LENGTH, MAX_FEEDBACK_SUGGESTION_LENGTH, FEEDBACK_TYPES } from '../constants/business.js';

export const AcceptViolationDecisionInputSchema = z.object({
  violationId: violationIdSchema,
}).strict();
export type AcceptViolationDecisionInput = z.infer<typeof AcceptViolationDecisionInputSchema>;

// Share-target types the short-link system can point at. New system entities (hall items,
// etc.) slot in by adding a `targetType` literal + its own union member below — no rework
// of the existing members. Each member carries exactly the id(s) its destination URL needs.
export const ShortLinkTargetTypeSchema = z.enum(['audition', 'audition-entry', 'commission']);
export type ShortLinkTargetType = z.infer<typeof ShortLinkTargetTypeSchema>;

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

export const SeedRulesAndAgreementsInputSchema = z.object({}).strict();
export type SeedRulesAndAgreementsInput = z.infer<typeof SeedRulesAndAgreementsInputSchema>;

export const SeedFuturePlansInputSchema = z.object({}).strict();
export type SeedFuturePlansInput = z.infer<typeof SeedFuturePlansInputSchema>;

// Content-pages migration (DJ ruling 2026-07-06): seed callables for the three
// editable content-page singletons (strict seed-if-empty — doc exists ⇒ no-op).
export const SeedTermsPageInputSchema = z.object({}).strict();
export type SeedTermsPageInput = z.infer<typeof SeedTermsPageInputSchema>;

export const SeedPrivacyPageInputSchema = z.object({}).strict();
export type SeedPrivacyPageInput = z.infer<typeof SeedPrivacyPageInputSchema>;

export const SeedTakeItDownPageCopyInputSchema = z.object({}).strict();
export type SeedTakeItDownPageCopyInput = z.infer<typeof SeedTakeItDownPageCopyInputSchema>;

/** Admin add/remove words on the self-owned curated profanity list (no external sync). */
export const CurateProfanityListInputSchema = z
  .object({
    add: z.array(z.string().min(1).max(64)).max(500).optional(),
    remove: z.array(z.string().min(1).max(64)).max(500).optional(),
  })
  .strict()
  .refine((v) => (v.add?.length ?? 0) + (v.remove?.length ?? 0) > 0, {
    message: 'Provide at least one word to add or remove.',
  });
export type CurateProfanityListInput = z.infer<typeof CurateProfanityListInputSchema>;

export const SubmitContentAppealInputSchema = z.object({
  violationId: violationIdSchema,
  appealMessage: z.string().min(1).max(MAX_APPEAL_MESSAGE_LENGTH),
}).strict();
export type SubmitContentAppealInput = z.infer<typeof SubmitContentAppealInputSchema>;

export const SubmitFeedbackInputSchema = z.object({
  feedbackType: z.enum(FEEDBACK_TYPES),
  suggestion: z.string().min(1).max(MAX_FEEDBACK_SUGGESTION_LENGTH).regex(/^[a-z]+$/),
}).strict();
export type SubmitFeedbackInput = z.infer<typeof SubmitFeedbackInputSchema>;

export const TrackShortLinkClickInputSchema = z.object({
  shortId: z.string().min(1).max(64),
}).strict();
export type TrackShortLinkClickInput = z.infer<typeof TrackShortLinkClickInputSchema>;

export const MarkAdminDispatchReadInputSchema = z.object({
  adminDispatchId: z.string().min(1).max(128),
}).strict();
export type MarkAdminDispatchReadInput = z.infer<typeof MarkAdminDispatchReadInputSchema>;

// Admin/jr-admin deletes a short link (`deleteShortLink`). Non-strict posture is carried
// faithfully from the source callable.
export const DeleteShortLinkInputSchema = z.object({
  shortId: z.string().min(1, 'shortId is required'),
});
export type DeleteShortLinkInput = z.infer<typeof DeleteShortLinkInputSchema>;

