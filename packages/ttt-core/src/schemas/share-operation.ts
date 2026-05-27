import { z } from 'zod';
import {
  workProjectIdSchema,
  userIdSchema,
} from './atoms.js';

// Mirrors the ShareOperation TS type in packages/ttt-core/src/types/work-project.ts.
// Each branch is .strict() — unknown keys are a contract violation.
//
// NOTE: The original ShareOperation type had an optional `projectData: FullProject`
// field. It was dead — no call site in ttt-prod ever populated it and the
// shareOperations handler never read it. Removed during the Zod migration.
//
// Per-branch shape decisions:
// - All branches accept optional `amount`, `user`, `sourceId` to match the
//   existing TS type. Business-logic checks (e.g. "add-pending requires user
//   OR sourceId") live in shareOperations.ts, NOT in the schema.
// - The accept-proposalArtisan operation has been removed; acceptance is now handled
//   via the invite flow.

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

export type ShareOperation = z.infer<typeof StakeShareOperationSchema>;
export type ShareOperationType = ShareOperation['type'];

// Re-export for convenience.
export const ManageProjectSharesInputSchema = z.object({
  projectId: workProjectIdSchema,
  operation: StakeShareOperationSchema,
}).strict();

export type ManageProjectSharesInput = z.infer<typeof ManageProjectSharesInputSchema>;

// ───────────────────────────────────────────────────────────────────
// PUBLIC SHARE OPERATION SCHEMA
//
// The `manageProjectShares` callable is exposed to authenticated
// creators. Only `add-active` is safe to invoke from a public surface —
// every other operation type is an internal/trusted-path concern:
//
//   - 'add-pending'      → only inviteUserToProject + runUpdateInviteShares
//   - 'remove-pending'   → only handleInviteDeclined + handleInviteCancelled
//   - 'create-workProject'   → only createProject
//   - 'convert-invite'   → only handleInviteAccepted
//
// Each of those internal callers performs its own workProject-action auth
// (invite.send, invite.shares.update, etc.) BEFORE composing into
// executeShareOperation. Allowing those operation types through the
// public callable bypasses the action layer — a artisanCreator could chain
// add-pending → convert-invite → create-workProject to grant themselves
// membership on any workProject.
//
// Keep this as a discriminated union so adding a second public-allowed
// type later is mechanical.
// ───────────────────────────────────────────────────────────────────
export const PublicStakeShareOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('add-active'),
    amount: z.number().int().positive().optional(),
    user: userRefSchema.optional(),
    sourceId: z.string().min(1).optional(),
  }).strict(),
]);

export type PublicShareOperation = z.infer<typeof PublicStakeShareOperationSchema>;
export type PublicShareOperationType = PublicShareOperation['type'];

export const PublicManageProjectSharesInputSchema = z.object({
  projectId: workProjectIdSchema,
  operation: PublicStakeShareOperationSchema,
}).strict();

export type PublicManageProjectSharesInput = z.infer<typeof PublicManageProjectSharesInputSchema>;
