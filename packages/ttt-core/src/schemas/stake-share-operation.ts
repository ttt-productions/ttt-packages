import { z } from 'zod';
import { workProjectIdSchema, userIdSchema, guildInviteIdSchema } from './atoms.js';

// The StakeShareOperation type is this schema's inference. Each branch is .strict() so unknown
// keys are a contract violation. Every branch accepts optional `amount`, `user`, `sourceId`;
// business-logic checks (for example, "add-pending requires user OR sourceId") live in
// stake-share-operations.ts, not in this schema.

const userRefSchema = z
  .object({
    uid: userIdSchema,
    displayName: z.string().optional(),
  })
  .strict();

export const StakeShareOperationSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('add-pending'),
      amount: z.number().int().positive().optional(),
      user: userRefSchema.optional(),
      sourceId: guildInviteIdSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('remove-pending'),
      amount: z.number().int().positive().optional(),
      user: userRefSchema.optional(),
      sourceId: guildInviteIdSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('add-active'),
      amount: z.number().int().positive().optional(),
      user: userRefSchema.optional(),
      sourceId: guildInviteIdSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('create-workProject'),
      amount: z.number().int().positive().optional(),
      user: userRefSchema.optional(),
      sourceId: guildInviteIdSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('convert-invite'),
      amount: z.number().int().positive().optional(),
      user: userRefSchema.optional(),
      sourceId: guildInviteIdSchema.optional(),
    })
    .strict(),
  // Member self-leave (leaveWorkProject). Pre-publish only; forfeits the leaver's
  // shares back to the pool. `user` is the leaver (server sets it to request.auth.uid).
  z
    .object({
      type: z.literal('depart'),
      user: userRefSchema,
      reason: z.literal('selfLeave'),
    })
    .strict(),
]);

export type StakeShareOperation = z.infer<typeof StakeShareOperationSchema>;
export type StakeShareOperationType = StakeShareOperation['type'];

export const ManageWorkProjectStakeSharesInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    operation: StakeShareOperationSchema,
  })
  .strict();

export type ManageWorkProjectStakeSharesInput = z.infer<
  typeof ManageWorkProjectStakeSharesInputSchema
>;

// PUBLIC STAKE-SHARE OPERATION SCHEMA
//
// The `manageWorkProjectStakeShares` callable is exposed to authenticated
// artisans. Only `add-active` is safe to invoke from a public surface.
//
// Internal-only operation types:
// - add-pending: inviteUserToGuild + runUpdateGuildInviteStakeShares
// - remove-pending: handleInviteDeclined + handleInviteCancelled
// - create-workProject: createWorkProject
// - convert-invite: handleInviteAccepted
// - depart: leaveWorkProject (member self-leave; forfeits shares to the pool)
//
// Internal callers run workProject-action auth (invite.send,
// guildInvite.stakeShares.update, and related checks) before composing into
// executeStakeShareOperation. Allowing these operation types publicly would
// bypass that action layer.

export const PublicStakeShareOperationSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('add-active'),
      amount: z.number().int().positive().optional(),
      user: userRefSchema.optional(),
      sourceId: guildInviteIdSchema.optional(),
    })
    .strict(),
]);

export type PublicStakeShareOperation = z.infer<typeof PublicStakeShareOperationSchema>;
export type PublicStakeShareOperationType = PublicStakeShareOperation['type'];

export const PublicManageWorkProjectStakeSharesInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    operation: PublicStakeShareOperationSchema,
  })
  .strict();

export type PublicManageWorkProjectStakeSharesInput = z.infer<
  typeof PublicManageWorkProjectStakeSharesInputSchema
>;

export const ManageWorkProjectStakeSharesResultSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});
export type ManageWorkProjectStakeSharesResult = z.infer<
  typeof ManageWorkProjectStakeSharesResultSchema
>;
