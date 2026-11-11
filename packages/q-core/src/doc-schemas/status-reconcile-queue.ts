import type { z } from 'zod';
import { createAccountRepairQueueEntrySchemas } from '@ttt-productions/auth-core';
import { ACCOUNT_STATUS_AUTH_EFFECT, ROLE_CLAIMS_EFFECT } from '../types/unions.js';
import { userStatusSchema } from './atoms.js';

const statusReconcileQueueEntrySchemas = createAccountRepairQueueEntrySchemas({
  statusEffect: ACCOUNT_STATUS_AUTH_EFFECT,
  claimEffects: [ROLE_CLAIMS_EFFECT],
  statusSchema: userStatusSchema,
});

export const StatusReconcileQueueAccountStatusEntrySchema =
  statusReconcileQueueEntrySchemas.statusEntry;
export type StatusReconcileQueueAccountStatusEntry = z.infer<
  typeof StatusReconcileQueueAccountStatusEntrySchema
>;

export const StatusReconcileQueueRoleClaimsEntrySchema =
  statusReconcileQueueEntrySchemas.claimsEntry;
export type StatusReconcileQueueRoleClaimsEntry = z.infer<
  typeof StatusReconcileQueueRoleClaimsEntrySchema
>;

export const StatusReconcileQueueEntrySchema = statusReconcileQueueEntrySchemas.entry;
export type StatusReconcileQueueEntry = z.infer<typeof StatusReconcileQueueEntrySchema>;
