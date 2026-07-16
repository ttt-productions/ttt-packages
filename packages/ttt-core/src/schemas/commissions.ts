import { z } from 'zod';
import { commissionListingIdSchema, commissionProposalIdSchema } from './atoms.js';
import { MAX_COMMISSION_DESCRIPTION_LENGTH } from '../constants/business.js';

export const CommissionProposalStatusSchema = z.enum([
  'open',
  'invited',
  'accepted',
  'rejected',
]);
export type CommissionProposalStatus = z.infer<typeof CommissionProposalStatusSchema>;

export const CloseCommissionInputSchema = z.object({
  commissionListingId: commissionListingIdSchema,
}).strict();
export type CloseCommissionInput = z.infer<typeof CloseCommissionInputSchema>;

export const DeleteCommissionInputSchema = z.object({
  commissionListingId: commissionListingIdSchema,
}).strict();
export type DeleteCommissionInput = z.infer<typeof DeleteCommissionInputSchema>;

export const RejectCommissionProposalInputSchema = z.object({
  commissionListingId: commissionListingIdSchema,
  commissionProposalId: commissionProposalIdSchema,
}).strict();
export type RejectCommissionProposalInput = z.infer<typeof RejectCommissionProposalInputSchema>;

export const SetCommissionProposalSavedInputSchema = z.object({
  commissionListingId: commissionListingIdSchema,
  commissionProposalId: commissionProposalIdSchema,
  saved: z.boolean(),
}).strict();
export type SetCommissionProposalSavedInput = z.infer<typeof SetCommissionProposalSavedInputSchema>;

export const CreateCommissionProposalTextInputSchema = z.object({
  commissionListingId: commissionListingIdSchema,
  coverLetterText: z.string().min(1).max(MAX_COMMISSION_DESCRIPTION_LENGTH),
}).strict();
export type CreateCommissionProposalTextInput = z.infer<typeof CreateCommissionProposalTextInputSchema>;

// Acceptance result of the commission-proposal MEDIA path (startUpload with fileOrigin
// 'commission-proposal'). Creation itself is asynchronous via the media pipeline; the
// proposal doc id is the CALLER's uid (one proposal per user per commission —
// runCreateCommissionProposal: commissionProposalId = callerUid), so it is knowable at
// accept time without any read. Non-strict (server → client result posture).
// (The TEXT path's created-item result, CreateCommissionProposalTextResultSchema, lives
// in ../doc-schemas/commissions.ts — it composes CommissionProposalSchema, and that
// module imports THIS one, so declaring it here would be a module cycle. It is
// re-exported on ./schemas via schemas/index.ts.)
export const ApplyToCommissionAcceptedResultSchema = z.object({
  success: z.literal(true),
  commissionListingId: commissionListingIdSchema,
  pendingMediaId: z.string().min(1),
  /** The eventual proposal doc id — the caller's uid (one proposal per user). */
  commissionProposalId: commissionProposalIdSchema,
});
export type ApplyToCommissionAcceptedResult = z.infer<typeof ApplyToCommissionAcceptedResultSchema>;


