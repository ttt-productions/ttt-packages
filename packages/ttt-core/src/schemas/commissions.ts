import { z } from 'zod';
import { commissionListingIdSchema, auditionEntryIdSchema } from './atoms.js';
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
  auditionEntryId: auditionEntryIdSchema,
}).strict();
export type RejectCommissionProposalInput = z.infer<typeof RejectCommissionProposalInputSchema>;

export const SetCommissionProposalSavedInputSchema = z.object({
  commissionListingId: commissionListingIdSchema,
  auditionEntryId: auditionEntryIdSchema,
  saved: z.boolean(),
}).strict();
export type SetCommissionProposalSavedInput = z.infer<typeof SetCommissionProposalSavedInputSchema>;

export const CreateCommissionProposalTextInputSchema = z.object({
  commissionListingId: commissionListingIdSchema,
  coverLetterText: z.string().min(1).max(MAX_COMMISSION_DESCRIPTION_LENGTH),
}).strict();
export type CreateCommissionProposalTextInput = z.infer<typeof CreateCommissionProposalTextInputSchema>;


