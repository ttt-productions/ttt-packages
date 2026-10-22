import { z } from 'zod';
import {
  adminDispatchIdSchema,
  guildInviteConversationStatusSchema,
  guildInviteIdSchema,
  userIdSchema,
  workProjectIdSchema,
} from './atoms.js';

export const AdminDispatchCloseStatusSchema = z.enum(['closed_resolved', 'closed_unresolved']);
export type AdminDispatchCloseStatus = z.infer<typeof AdminDispatchCloseStatusSchema>;

export const UpdateAdminDispatchStatusInputSchema = z
  .object({
    adminDispatchId: adminDispatchIdSchema,
    newStatus: AdminDispatchCloseStatusSchema,
  })
  .strict();
export type UpdateAdminDispatchStatusInput = z.infer<typeof UpdateAdminDispatchStatusInputSchema>;

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

export const GuildInviteAcceptedAuditPayloadSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    guildInviteId: guildInviteIdSchema,
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
  outboxCommandId: z.string().min(1),
});
export type UpdateGuildInviteStakeSharesResult = z.infer<
  typeof UpdateGuildInviteStakeSharesResultSchema
>;

export const UpdateAdminDispatchStatusResultSchema = z.object({
  success: z.literal(true),
  adminDispatchId: adminDispatchIdSchema,
  newStatus: AdminDispatchCloseStatusSchema,
  closedBy: z.string().min(1),
  auditEventId: z.string().min(1).optional(),
});
export type UpdateAdminDispatchStatusResult = z.infer<typeof UpdateAdminDispatchStatusResultSchema>;
