import { z } from 'zod';
import { ACCOUNT_STATUS_AUTH_EFFECT, ROLE_CLAIMS_EFFECT } from '../types/unions.js';
import { countSchema, documentIdSegmentSchema, epochMsSchema, userStatusSchema } from './atoms.js';

const statusReconcileQueueEntryBase = {
  enqueuedAt: epochMsSchema,
  lastAttemptAt: epochMsSchema.optional(),
  attemptCount: countSchema,
};

export const StatusReconcileQueueAccountStatusEntrySchema = z.strictObject({
  ...statusReconcileQueueEntryBase,
  authEffect: z.literal(ACCOUNT_STATUS_AUTH_EFFECT),
  reason: z.literal('statusChangePending'),
  targetStatus: userStatusSchema,
  writeId: documentIdSegmentSchema,
});
export type StatusReconcileQueueAccountStatusEntry = z.infer<
  typeof StatusReconcileQueueAccountStatusEntrySchema
>;

export const StatusReconcileQueueRoleClaimsEntrySchema = z.strictObject({
  ...statusReconcileQueueEntryBase,
  authEffect: z.literal(ROLE_CLAIMS_EFFECT),
  reason: z.literal('postCommitAuthEffectFailed'),
});
export type StatusReconcileQueueRoleClaimsEntry = z.infer<
  typeof StatusReconcileQueueRoleClaimsEntrySchema
>;

export const StatusReconcileQueueEntrySchema = z.discriminatedUnion('authEffect', [
  StatusReconcileQueueAccountStatusEntrySchema,
  StatusReconcileQueueRoleClaimsEntrySchema,
]);
export type StatusReconcileQueueEntry = z.infer<typeof StatusReconcileQueueEntrySchema>;
