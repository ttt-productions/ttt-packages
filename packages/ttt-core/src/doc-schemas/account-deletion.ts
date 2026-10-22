import { z } from 'zod';

export const AccountDeletionRequestStatusSchema = z.enum([
  'pending',
  'cancelled',
  'scrubbing',
  'leased',
  'parkedOnHold',
  'completed',
  'superseded',
]);
export type AccountDeletionRequestStatus = z.infer<typeof AccountDeletionRequestStatusSchema>;

export const ACCOUNT_DELETION_REQUEST_ORIGINS = ['memberRequest', 'discoveredUnder13'] as const;
export const AccountDeletionRequestOriginSchema = z.enum(ACCOUNT_DELETION_REQUEST_ORIGINS);
export type AccountDeletionRequestOrigin = z.infer<typeof AccountDeletionRequestOriginSchema>;

const DELETION_REQUEST_STATUS_IS_ACTIVE = {
  pending: true,
  cancelled: false,
  scrubbing: false,
  leased: false,
  parkedOnHold: true,
  completed: false,
  superseded: false,
} as const satisfies Record<AccountDeletionRequestStatus, boolean>;

export type ActiveDeletionRequestStatus = {
  [K in AccountDeletionRequestStatus]: (typeof DELETION_REQUEST_STATUS_IS_ACTIVE)[K] extends true
    ? K
    : never;
}[AccountDeletionRequestStatus];

export const ACTIVE_DELETION_REQUEST_STATUSES: readonly ActiveDeletionRequestStatus[] = (
  Object.keys(DELETION_REQUEST_STATUS_IS_ACTIVE) as AccountDeletionRequestStatus[]
).filter(
  (status): status is ActiveDeletionRequestStatus => DELETION_REQUEST_STATUS_IS_ACTIVE[status],
);

const DELETION_REQUEST_STATUS_IS_MID_SCRUB = {
  pending: false,
  cancelled: false,
  scrubbing: true,
  leased: true,
  parkedOnHold: false,
  completed: false,
  superseded: false,
} as const satisfies Record<AccountDeletionRequestStatus, boolean>;

export type MidScrubDeletionRequestStatus = {
  [K in AccountDeletionRequestStatus]: (typeof DELETION_REQUEST_STATUS_IS_MID_SCRUB)[K] extends true
    ? K
    : never;
}[AccountDeletionRequestStatus];

export const MID_SCRUB_DELETION_REQUEST_STATUSES: readonly MidScrubDeletionRequestStatus[] = (
  Object.keys(DELETION_REQUEST_STATUS_IS_MID_SCRUB) as AccountDeletionRequestStatus[]
).filter(
  (status): status is MidScrubDeletionRequestStatus => DELETION_REQUEST_STATUS_IS_MID_SCRUB[status],
);

export function isActiveDeletionRequest(status: unknown): status is ActiveDeletionRequestStatus {
  return (
    typeof status === 'string' &&
    (ACTIVE_DELETION_REQUEST_STATUSES as readonly string[]).includes(status)
  );
}

export const ErasureLeaseV1Schema = z
  .object({
    epoch: z.number().int().nonnegative(),
    state: z.enum(['active', 'revoked', 'released']),
    acquiredAt: z.number(),
    expiresAt: z.number(),
    phase: z.string().optional(),
    revokedByHoldRefId: z.string().min(1).optional(),
    revokedAt: z.number().optional(),
    releasedAt: z.number().optional(),
  })
  .strict();
export type ErasureLeaseV1 = z.infer<typeof ErasureLeaseV1Schema>;

export const AccountDeletionRequestV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    uid: z.string().min(1),
    status: AccountDeletionRequestStatusSchema,
    requestedAt: z.number(),
    scheduledScrubAt: z.number(),
    graceDays: z.number(),
    origin: AccountDeletionRequestOriginSchema,
    cancelledAt: z.number().optional(),
    tokenRevocationNextAttemptAt: z.number().optional(),
    tokensRevokedAt: z.number().optional(),
    scrubStartedAt: z.number().optional(),
    parkedReason: z.string().optional(),
    parkedAt: z.number().optional(),
    lastHoldCheckAt: z.number().optional(),
    completedAt: z.number().optional(),
    supersededAt: z.number().optional(),
    supersededReason: z.string().optional(),
    erasureLease: ErasureLeaseV1Schema.optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .strict();
export type AccountDeletionRequestV1 = z.infer<typeof AccountDeletionRequestV1Schema>;
