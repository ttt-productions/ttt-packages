import { z } from 'zod';
import { adminDispatchIdSchema, guildInviteIdSchema } from './atoms.js';

// The close message is composed SERVER-SIDE from the authoritative actor role; the client
// supplies no message text (a client-supplied value would be a system-message spoof vector).
export const UpdateAdminDispatchStatusInputSchema = z.object({
  adminDispatchId: adminDispatchIdSchema,
  newStatus: z.enum(['closed_resolved', 'closed_unresolved']),
}).strict();
export type UpdateAdminDispatchStatusInput = z.infer<typeof UpdateAdminDispatchStatusInputSchema>;

export const UpdateInviteConfirmationInputSchema = z.object({
  guildInviteId: guildInviteIdSchema,
  action: z.enum(['agree', 'decline', 'cancel', 'retract']),
}).strict();
export type UpdateInviteConfirmationInput = z.infer<typeof UpdateInviteConfirmationInputSchema>;

export const UpdateGuildInviteStakeSharesInputSchema = z.object({
  guildInviteId: guildInviteIdSchema,
  newStakeShares: z.number().int().min(1),
}).strict();
export type UpdateGuildInviteStakeSharesInput = z.infer<typeof UpdateGuildInviteStakeSharesInputSchema>;

// Admin/jr-admin deletes a user's support dispatch thread (`deleteAdminDispatch`). Non-strict
// posture is carried faithfully from the source callable.
export const DeleteAdminDispatchInputSchema = z.object({
  adminDispatchId: adminDispatchIdSchema,
});
export type DeleteAdminDispatchInput = z.infer<typeof DeleteAdminDispatchInputSchema>;


