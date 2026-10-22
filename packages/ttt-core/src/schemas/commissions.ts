import { z } from 'zod';
import {
  commissionListingIdSchema,
  commissionProposalIdSchema,
  userIdSchema,
  workProjectIdSchema,
} from './atoms.js';
import { COMMISSION_COVER_LETTER_INPUT } from '../constants/text-fields.js';
import { COMMISSION_PROPOSAL_AGREEMENT_VERSION } from '../constants/member-agreements.js';
import { textFieldSchema } from './text-field.js';

export const CommissionProposalStatusSchema = z.enum(['open', 'invited', 'accepted', 'rejected']);
export type CommissionProposalStatus = z.infer<typeof CommissionProposalStatusSchema>;

export const CloseCommissionInputSchema = z
  .object({
    commissionListingId: commissionListingIdSchema,
  })
  .strict();
export type CloseCommissionInput = z.infer<typeof CloseCommissionInputSchema>;

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
    agreementVersion: z.literal(COMMISSION_PROPOSAL_AGREEMENT_VERSION),
  })
  .strict();
export type CreateCommissionProposalTextInput = z.infer<
  typeof CreateCommissionProposalTextInputSchema
>;

export const ApplyToCommissionAcceptedResultSchema = z.object({
  success: z.literal(true),
  commissionListingId: commissionListingIdSchema,
  pendingMediaId: z.string().min(1),
  commissionProposalId: commissionProposalIdSchema,
});
export type ApplyToCommissionAcceptedResult = z.infer<typeof ApplyToCommissionAcceptedResultSchema>;
