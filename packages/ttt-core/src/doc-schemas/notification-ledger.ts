// Notification redesign ledger Firestore schemas (chat-edge-rebuild P1).
// Frozen field lists from IMPLEMENTATION_MATRIX.md "Notifications". Admin-SDK-only.
// `expireAt` is the only Firestore `Timestamp` field (native TTL); every other
// time field is epoch-ms `number`.

import { z } from 'zod';

/** Native-TTL Timestamp (set only at the resolved-success terminal). */
const expireAtField = z.unknown().optional();

/** The materialization payload carried on every delivery row. */
export const NotificationDeliveryPayloadSchema = z.object({
  actorId: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  occurrenceAt: z.number(),
});

// ── notificationDeliveries/{deliveryId} ─────────────────────────────────────
// BOTH the recipient ledger AND the occurrence ledger. Shared-admin rows set
// recipientUid=null (the deliveryId hash uses the literal 'shared').
export const NotificationDeliverySchema = z.object({
  deliveryId: z.string(),
  state: z.enum(['queued', 'materialized', 'deadLetter']),
  notificationType: z.string(),
  eventId: z.string(),
  recipientUid: z.string().nullable(),
  aggregationKey: z.string(),
  strategy: z.enum(['increment', 'staticRelight']),
  payload: NotificationDeliveryPayloadSchema,
  payloadVersion: z.number(),
  materializationClass: z.enum(['directQueued', 'realtimeFallback', 'fanoutOrphan', 'retry']),
  createdAt: z.number(),
  attemptCount: z.number(),
  nextAttemptAt: z.number(),
  lastError: z.string().nullable(),
  materializedAt: z.number().nullable(),
  deadLetteredAt: z.number().nullable(),
  expireAt: expireAtField,
});
export type NotificationDelivery = z.infer<typeof NotificationDeliverySchema>;

// ── notificationFanoutJobs/{jobId} ──────────────────────────────────────────
// jobId = `${eventId}:${notificationType}`. No `running` state (no leases).
export const NotificationFanoutPhaseSchema = z.object({
  selector: z.record(z.string(), z.unknown()),
  cursor: z.unknown().nullable(),
  done: z.boolean(),
});

export const NotificationFanoutJobSchema = z.object({
  jobId: z.string(),
  schemaVersion: z.number(),
  notificationType: z.string(),
  eventId: z.string(),
  priority: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  payload: z.record(z.string(), z.unknown()),
  phases: z.array(NotificationFanoutPhaseSchema),
  phaseIndex: z.number(),
  revision: z.number(),
  status: z.enum(['pending', 'complete', 'deadLetter']),
  attemptCount: z.number(),
  nextAttemptAt: z.number(),
  lastError: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
  completedAt: z.number().nullable(),
  deadLetteredAt: z.number().nullable(),
  expireAt: expireAtField,
});
export type NotificationFanoutJob = z.infer<typeof NotificationFanoutJobSchema>;
