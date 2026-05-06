import { z } from 'zod';
import {
  projectIdSchema,
  userIdSchema,
} from './atoms.js';

// Mirrors the ShareOperation TS type in packages/ttt-core/src/types/project.ts.
// Each branch is .strict() — unknown keys are a contract violation.
//
// NOTE: The original ShareOperation type had an optional `projectData: FullProject`
// field. It was dead — no call site in ttt-prod ever populated it and the
// shareOperations handler never read it. Removed during the Zod migration.
//
// Per-branch shape decisions:
// - All branches accept optional `amount`, `user`, `sourceId`, `sourceType` to
//   match the existing TS type. Business-logic checks (e.g. "add-pending requires
//   user OR sourceId") live in shareOperations.ts, NOT in the schema.
// - sourceType is constrained to its two known values.

const userRefSchema = z.object({
  uid: userIdSchema,
}).strict();

const sourceTypeSchema = z.enum(['invite', 'job']);

export const ShareOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('add-pending'),
    amount: z.number().int().positive().optional(),
    user: userRefSchema.optional(),
    sourceId: z.string().min(1).optional(),
    sourceType: sourceTypeSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('remove-pending'),
    amount: z.number().int().positive().optional(),
    user: userRefSchema.optional(),
    sourceId: z.string().min(1).optional(),
    sourceType: sourceTypeSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('add-active'),
    amount: z.number().int().positive().optional(),
    user: userRefSchema.optional(),
    sourceId: z.string().min(1).optional(),
    sourceType: sourceTypeSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('create-project'),
    amount: z.number().int().positive().optional(),
    user: userRefSchema.optional(),
    sourceId: z.string().min(1).optional(),
    sourceType: sourceTypeSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('convert-invite'),
    amount: z.number().int().positive().optional(),
    user: userRefSchema.optional(),
    sourceId: z.string().min(1).optional(),
    sourceType: sourceTypeSchema.optional(),
  }).strict(),
]);

export type ShareOperation = z.infer<typeof ShareOperationSchema>;
export type ShareOperationType = ShareOperation['type'];

// Re-export for convenience.
export const ManageProjectSharesInputSchema = z.object({
  projectId: projectIdSchema,
  operation: ShareOperationSchema,
}).strict();

export type ManageProjectSharesInput = z.infer<typeof ManageProjectSharesInputSchema>;
