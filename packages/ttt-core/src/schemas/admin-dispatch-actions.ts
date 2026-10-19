import { z } from 'zod';
import {
  adminDispatchIdSchema,
  guildInviteConversationStatusSchema,
  guildInviteIdSchema,
  userIdSchema,
  workProjectIdSchema,
} from './atoms.js';

/** The two terminal dispatch-thread statuses a close can set (ONE canonical declaration —
 * shared by the close input and its authoritative result). */
export const AdminDispatchCloseStatusSchema = z.enum(['closed_resolved', 'closed_unresolved']);
export type AdminDispatchCloseStatus = z.infer<typeof AdminDispatchCloseStatusSchema>;

// The close message is composed SERVER-SIDE from the authoritative actor role; the client
// supplies no message text (a client-supplied value would be a system-message spoof vector).
export const UpdateAdminDispatchStatusInputSchema = z
  .object({
    adminDispatchId: adminDispatchIdSchema,
    newStatus: AdminDispatchCloseStatusSchema,
  })
  .strict();
export type UpdateAdminDispatchStatusInput = z.infer<typeof UpdateAdminDispatchStatusInputSchema>;

// The invite conversation is the binding agreement, so consent is pinned to specific terms:
// an `agree` must carry the stake-share offer the member was shown, and the backend rejects
// the action inside its transaction when the doc's current offer differs (the member re-agrees
// against the fresh value). The other actions don't assert terms and carry no pin.
export const UpdateInviteConfirmationInputSchema = z.discriminatedUnion('action', [
  z
    .object({
      guildInviteId: guildInviteIdSchema,
      action: z.literal('agree'),
      expectedStakeShares: z.number().int().min(1),
    })
    .strict(),
  z
    .object({
      guildInviteId: guildInviteIdSchema,
      action: z.enum(['decline', 'cancel', 'retract']),
    })
    .strict(),
]);
export type UpdateInviteConfirmationInput = z.infer<typeof UpdateInviteConfirmationInputSchema>;

export const UpdateGuildInviteConfirmationResultSchema = z.object({
  success: z.literal(true),
  status: guildInviteConversationStatusSchema,
  workProjectId: workProjectIdSchema,
  senderUid: userIdSchema,
  recipientUid: userIdSchema,
  callerUid: userIdSchema,
});
export type UpdateGuildInviteConfirmationResult = z.infer<
  typeof UpdateGuildInviteConfirmationResultSchema
>;

/**
 * The payload of the `workProject.guildInviteAccepted` event the finalizing agree writes: the
 * invite, the offer agreed to, and the account that gave the Work's agreement — the caller when
 * the Work's agree finalizes, else the invite's stored `senderConfirmedBy`. Ids and numbers only
 * (BACKEND-203).
 */
export const GuildInviteAcceptedAuditPayloadSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    guildInviteId: guildInviteIdSchema,
    // Whatever offer the invite held, so an anomalous stored value is still recorded.
    stakeSharesOffered: z.number(),
    senderConfirmedBy: userIdSchema,
  })
  .strict();
export type GuildInviteAcceptedAuditPayload = z.infer<typeof GuildInviteAcceptedAuditPayloadSchema>;

export const UpdateGuildInviteStakeSharesInputSchema = z
  .object({
    guildInviteId: guildInviteIdSchema,
    newStakeShares: z.number().int().min(1),
  })
  .strict();
export type UpdateGuildInviteStakeSharesInput = z.infer<
  typeof UpdateGuildInviteStakeSharesInputSchema
>;

export const UpdateGuildInviteStakeSharesResultSchema = z.object({
  success: z.literal(true),
  newStakeShares: z.number().int(),
  workProjectId: workProjectIdSchema,
  senderUid: userIdSchema,
  recipientUid: userIdSchema,
  /** The outbox command written in the same transaction, delivered right after the commit. */
  outboxCommandId: z.string().min(1),
});
export type UpdateGuildInviteStakeSharesResult = z.infer<
  typeof UpdateGuildInviteStakeSharesResultSchema
>;

export const UpdateAdminDispatchStatusResultSchema = z.object({
  success: z.literal(true),
  adminDispatchId: adminDispatchIdSchema,
  /** The thread's status after commit. */
  newStatus: AdminDispatchCloseStatusSchema,
  /** Uid of the closer (the caller) — attribution for the server-composed close line. */
  closedBy: z.string().min(1),
  /** Operation-receipt audit id — the `chat.adminThreadStatusChanged` event written in the same
   * transaction. */
  auditEventId: z.string().min(1).optional(),
});
export type UpdateAdminDispatchStatusResult = z.infer<typeof UpdateAdminDispatchStatusResultSchema>;
