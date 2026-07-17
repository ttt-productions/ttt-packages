import { z } from 'zod';
import { adminDispatchIdSchema, guildInviteIdSchema } from './atoms.js';

/** The two terminal dispatch-thread statuses a close can set (ONE canonical declaration —
 * shared by the close input and its authoritative result). */
export const AdminDispatchCloseStatusSchema = z.enum(['closed_resolved', 'closed_unresolved']);
export type AdminDispatchCloseStatus = z.infer<typeof AdminDispatchCloseStatusSchema>;

// The close message is composed SERVER-SIDE from the authoritative actor role; the client
// supplies no message text (a client-supplied value would be a system-message spoof vector).
export const UpdateAdminDispatchStatusInputSchema = z.object({
  adminDispatchId: adminDispatchIdSchema,
  newStatus: AdminDispatchCloseStatusSchema,
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

// --- Authoritative mutation RESULTS (non-strict server → client posture) ---

export const UpdateAdminDispatchStatusResultSchema = z.object({
  success: z.literal(true),
  adminDispatchId: adminDispatchIdSchema,
  /** The thread's status after commit. */
  newStatus: AdminDispatchCloseStatusSchema,
  /** Uid of the closer (the caller) — attribution for the server-composed close line. */
  closedBy: z.string().min(1),
  /** Operation-receipt audit id — the `chat.adminThreadStatusChanged` event written in the same
   * transaction. Optional/additive; the domain id (`adminDispatchId`) is already carried above. */
  auditEventId: z.string().min(1).optional(),
});
export type UpdateAdminDispatchStatusResult = z.infer<typeof UpdateAdminDispatchStatusResultSchema>;

export const DeleteAdminDispatchResultSchema = z.object({
  success: z.literal(true),
  adminDispatchId: adminDispatchIdSchema,
  /** Conversation messages removed with the thread (counted during the delete itself). */
  deletedMessageCount: z.number().int().nonnegative(),
  /** Operation-receipt audit id — the `admin.dispatchDeleted` event written in the same
   * transaction. Optional/additive; the domain id (`adminDispatchId`) is already carried above. */
  auditEventId: z.string().min(1).optional(),
});
export type DeleteAdminDispatchResult = z.infer<typeof DeleteAdminDispatchResultSchema>;


