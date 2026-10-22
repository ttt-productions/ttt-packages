import { z } from 'zod';
import { workProjectIdSchema, userIdSchema, guildInviteIdSchema } from './atoms.js';

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
