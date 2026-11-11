import { z } from 'zod';

export const ACCOUNT_STATUS_PENDING_REASON = 'statusChangePending';

export const AUTH_EFFECT_FAILED_REASON = 'postCommitAuthEffectFailed';

const queueTimeSchema = z.number().int().nonnegative();

export interface AccountRepairQueueSchemaConfig<
  StatusEffect extends string,
  ClaimEffects extends readonly [string, ...string[]],
  StatusSchema extends z.ZodType<string>,
> {
  readonly statusEffect: StatusEffect;
  readonly claimEffects: ClaimEffects;
  readonly statusSchema: StatusSchema;
}

export function createAccountRepairQueueEntrySchemas<
  const StatusEffect extends string,
  const ClaimEffects extends readonly [string, ...string[]],
  StatusSchema extends z.ZodType<string>,
>(config: AccountRepairQueueSchemaConfig<StatusEffect, ClaimEffects, StatusSchema>) {
  const base = {
    enqueuedAt: queueTimeSchema,
    lastAttemptAt: queueTimeSchema.optional(),
    attemptCount: z.number().int().nonnegative(),
  };
  const statusEntry = z.object({
    ...base,
    authEffect: z.literal(config.statusEffect),
    reason: z.literal(ACCOUNT_STATUS_PENDING_REASON),
    targetStatus: config.statusSchema,
    writeId: z.string().regex(/^[^/]+$/),
  });
  const claimsEntry = z.object({
    ...base,
    authEffect: z.enum(config.claimEffects),
    reason: z.literal(AUTH_EFFECT_FAILED_REASON),
  });
  return {
    statusEntry,
    claimsEntry,
    entry: z.discriminatedUnion('authEffect', [statusEntry, claimsEntry]),
  };
}
