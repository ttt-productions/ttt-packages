// `statusReconcileQueue/{userId}` — the backend-only retry queue for an account's post-commit
// Firebase Auth effects (RULE-STD-QUALITY-104, RULE-STD-BACKEND-302). One entry per account, id = the userId, whichever
// effect queued it. A status change writes its entry in the status transaction itself; a role-claim
// entry is written when a roster change committed but its claim write failed. The drain re-converges
// every Auth-side mirror of the account from its canonical documents and deletes the entry once it
// has, so the entry names why the account was queued, never what to apply. Only the retry ledger
// (`attemptCount`, `lastAttemptAt`) is written back.

import { z } from 'zod';
import { ACCOUNT_STATUS_AUTH_EFFECT, ROLE_CLAIMS_EFFECT } from '../types/unions.js';
import { countSchema, documentIdSegmentSchema, epochMsSchema, userStatusSchema } from './atoms.js';

const statusReconcileQueueEntryBase = {
  enqueuedAt: epochMsSchema,
  lastAttemptAt: epochMsSchema.optional(),
  attemptCount: countSchema,
};

/**
 * A status change's Auth effect, owed until it lands. `writeId` names the status change that wrote
 * it: a removal compares it, so finishing an older change never removes the entry a newer change
 * wrote. The drain converges the account on its canonical status, never on `targetStatus`.
 */
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

/** A failed `admin` / `referee` claim write. It carries no status. */
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
