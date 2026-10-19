import { z } from 'zod';
import {
  commissionListingIdSchema,
  commissionProposalIdSchema,
  userIdSchema,
  workProjectIdSchema,
} from './atoms.js';
import { COMMISSION_COVER_LETTER_INPUT } from '../constants/text-fields.js';
import { textFieldSchema } from './text-field.js';

export const CommissionProposalStatusSchema = z.enum(['open', 'invited', 'accepted', 'rejected']);
export type CommissionProposalStatus = z.infer<typeof CommissionProposalStatusSchema>;

export const CloseCommissionInputSchema = z
  .object({
    commissionListingId: commissionListingIdSchema,
  })
  .strict();
export type CloseCommissionInput = z.infer<typeof CloseCommissionInputSchema>;

// ONE result for the member close and its admin-review twin.
export const CloseCommissionResultSchema = z.object({
  success: z.literal(true),
  commissionListingId: commissionListingIdSchema,
  workProjectId: workProjectIdSchema,
});
export type CloseCommissionResult = z.infer<typeof CloseCommissionResultSchema>;

export const RejectCommissionProposalInputSchema = z
  .object({
    commissionListingId: commissionListingIdSchema,
    commissionProposalId: commissionProposalIdSchema,
  })
  .strict();
export type RejectCommissionProposalInput = z.infer<typeof RejectCommissionProposalInputSchema>;

export const RejectCommissionProposalResultSchema = z.object({
  success: z.literal(true),
  commissionListingId: commissionListingIdSchema,
  commissionProposalId: commissionProposalIdSchema,
  commissionProposerUid: userIdSchema,
});
export type RejectCommissionProposalResult = z.infer<typeof RejectCommissionProposalResultSchema>;

export const SetCommissionProposalSavedInputSchema = z
  .object({
    commissionListingId: commissionListingIdSchema,
    commissionProposalId: commissionProposalIdSchema,
    saved: z.boolean(),
  })
  .strict();
export type SetCommissionProposalSavedInput = z.infer<typeof SetCommissionProposalSavedInputSchema>;

export const SetCommissionProposalSavedResultSchema = z.object({
  success: z.literal(true),
  commissionListingId: commissionListingIdSchema,
  commissionProposalId: commissionProposalIdSchema,
  saved: z.boolean(),
});
export type SetCommissionProposalSavedResult = z.infer<
  typeof SetCommissionProposalSavedResultSchema
>;

export const CreateCommissionProposalTextInputSchema = z
  .object({
    commissionListingId: commissionListingIdSchema,
    coverLetterText: textFieldSchema(COMMISSION_COVER_LETTER_INPUT),
  })
  .strict();
export type CreateCommissionProposalTextInput = z.infer<
  typeof CreateCommissionProposalTextInputSchema
>;

// Acceptance result of the commission-proposal MEDIA path (startUpload with fileOrigin
// 'commission-proposal'). Creation itself is asynchronous via the media pipeline; the
// proposal doc id is the CALLER's uid (one proposal per user per commission —
// runCreateCommissionProposal: commissionProposalId = callerUid), so it is knowable at
// accept time without any read.
// (The TEXT path's created-item result, CreateCommissionProposalTextResultSchema, lives
// in ../doc-schemas/commissions.ts — it composes CommissionProposalSchema, and that
// module imports THIS one, so declaring it here would be a module cycle.)
export const ApplyToCommissionAcceptedResultSchema = z.object({
  success: z.literal(true),
  commissionListingId: commissionListingIdSchema,
  pendingMediaId: z.string().min(1),
  /** The eventual proposal doc id — the caller's uid (one proposal per user). */
  commissionProposalId: commissionProposalIdSchema,
});
export type ApplyToCommissionAcceptedResult = z.infer<typeof ApplyToCommissionAcceptedResultSchema>;
