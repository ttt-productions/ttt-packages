import { z } from 'zod';
import { adminDispatchIdSchema, guildInviteIdSchema } from './atoms.js';
import { MAX_CHAT_MESSAGE_LENGTH } from '../constants/chat.js';

export const UpdateAdminDispatchStatusInputSchema = z.object({
  adminDispatchId: adminDispatchIdSchema,
  newStatus: z.enum(['closed_resolved', 'closed_unresolved']),
  lastMessage: z.string().min(1).max(MAX_CHAT_MESSAGE_LENGTH),
}).strict();
export type UpdateAdminDispatchStatusInput = z.infer<typeof UpdateAdminDispatchStatusInputSchema>;

export const UpdateInviteConfirmationInputSchema = z.object({
  guildInviteId: guildInviteIdSchema,
  action: z.enum(['agree', 'decline', 'cancel', 'retract']),
}).strict();
export type UpdateInviteConfirmationInput = z.infer<typeof UpdateInviteConfirmationInputSchema>;

export const UpdateInviteSharesInputSchema = z.object({
  guildInviteId: guildInviteIdSchema,
  newStakeShares: z.number().int().min(1),
}).strict();
export type UpdateInviteSharesInput = z.infer<typeof UpdateInviteSharesInputSchema>;


