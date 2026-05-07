import { z } from 'zod';
import { messageIdSchema, inviteIdSchema } from './atoms.js';
import { MAX_CHAT_MESSAGE_LENGTH } from '../constants/chat.js';

export const UpdateAdminMessageStatusInputSchema = z.object({
  messageId: messageIdSchema,
  newStatus: z.enum(['closed_resolved', 'closed_unresolved']),
  lastMessage: z.string().min(1).max(MAX_CHAT_MESSAGE_LENGTH),
}).strict();
export type UpdateAdminMessageStatusInput = z.infer<typeof UpdateAdminMessageStatusInputSchema>;

export const UpdateInviteConfirmationInputSchema = z.object({
  inviteId: inviteIdSchema,
  action: z.enum(['agree', 'decline', 'cancel', 'retract']),
}).strict();
export type UpdateInviteConfirmationInput = z.infer<typeof UpdateInviteConfirmationInputSchema>;

export const UpdateInviteSharesInputSchema = z.object({
  inviteId: inviteIdSchema,
  newShares: z.number().int().min(0),
}).strict();
export type UpdateInviteSharesInput = z.infer<typeof UpdateInviteSharesInputSchema>;
