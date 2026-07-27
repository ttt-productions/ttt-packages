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

// The invite conversation is the binding agreement, so consent is pinned to specific terms:
// an `agree` must carry the stake-share offer the member was shown, and the backend rejects
// the action inside its transaction when the doc's current offer differs (the member re-agrees
// against the fresh value). The other actions don't assert terms and carry no pin.
export const UpdateInviteConfirmationInputSchema = z.discriminatedUnion('action', [
  z.object({
    guildInviteId: guildInviteIdSchema,
    action: z.literal('agree'),
    expectedStakeShares: z.number().int().min(1),
  }).strict(),
  z.object({
    guildInviteId: guildInviteIdSchema,
    action: z.enum(['decline', 'cancel', 'retract']),
  }).strict(),
]);
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


