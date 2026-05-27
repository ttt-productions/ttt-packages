import { z } from 'zod';
import {
  workProjectIdSchema,
  userIdSchema,
} from './atoms.js';

// Mirrors the StakeShareOperation TS type in packages/ttt-core/src/types/work-project.ts.
// Each branch is .strict() so unknown keys are a contract violation.
//
// NOTE: The original StakeShareOperation type had an optional `workProjectData: FullWorkProject`
// field. It was dead: no call site in ttt-prod populated it and the
// stake-share operation handler never read it. Removed during the Zod migration.
//
// Per-branch shape decisions:
// - All branches accept optional `amount`, `user`, `sourceId` to match the
//   existing TS type. Business-logic checks (for example, "add-pending requires
//   user OR sourceId") live in stake-share-operations.ts, not in this schema.
// - The accept-proposalArtisan operation has been removed; acceptance now flows
//   through guild-invite handling.

const userRefSchema = z.object({
  uid: userIdSchema,
  displayName: z.string().optional(),
}).strict();

export const StakeShareOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('add-pending'),
    amount: z.number().int().positive().optional(),
    user: userRefSchema.optional(),
    sourceId: z.string().min(1).optional(),
  }).strict(),
  z.object({
    type: z.literal('remove-pending'),
    amount: z.number().int().positive().optional(),
    user: userRefSchema.optional(),
    sourceId: z.string().min(1).optional(),
  }).strict(),
  z.object({
    type: z.literal('add-active'),
    amount: z.number().int().positive().optional(),
    user: userRefSchema.optional(),
    sourceId: z.string().min(1).optional(),
  }).strict(),
  z.object({
    type: z.literal('create-workProject'),
    amount: z.number().int().positive().optional(),
    user: userRefSchema.optional(),
    sourceId: z.string().min(1).optional(),
  }).strict(),
  z.object({
    type: z.literal('convert-invite'),
    amount: z.number().int().positive().optional(),
    user: userRefSchema.optional(),
    sourceId: z.string().min(1).optional(),
  }).strict(),
]);

export type StakeShareOperation = z.infer<typeof StakeShareOperationSchema>;
export type StakeShareOperationType = StakeShareOperation['type'];

export const ManageWorkProjectStakeSharesInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  operation: StakeShareOperationSchema,
}).strict();

export type ManageWorkProjectStakeSharesInput = z.infer<typeof ManageWorkProjectStakeSharesInputSchema>;

// PUBLIC STAKE-SHARE OPERATION SCHEMA
//
// The `manageWorkProjectStakeShares` callable is exposed to authenticated
// creators. Only `add-active` is safe to invoke from a public surface.
//
// Internal-only operation types:
// - add-pending: inviteUserToGuild + runUpdateGuildInviteStakeShares
// - remove-pending: handleInviteDeclined + handleInviteCancelled
// - create-workProject: createWorkProject
// - convert-invite: handleInviteAccepted
//
// Internal callers run workProject-action auth (invite.send,
// guildInvite.stakeShares.update, and related checks) before composing into
// executeStakeShareOperation. Allowing these operation types publicly would
// bypass that action layer.

export const PublicStakeShareOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('add-active'),
    amount: z.number().int().positive().optional(),
    user: userRefSchema.optional(),
    sourceId: z.string().min(1).optional(),
  }).strict(),
]);

export type PublicStakeShareOperation = z.infer<typeof PublicStakeShareOperationSchema>;
export type PublicStakeShareOperationType = PublicStakeShareOperation['type'];

export const PublicManageWorkProjectStakeSharesInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  operation: PublicStakeShareOperationSchema,
}).strict();

export type PublicManageWorkProjectStakeSharesInput = z.infer<typeof PublicManageWorkProjectStakeSharesInputSchema>;
