// Notification delivery-ledger and fanout-job Firestore schemas. Admin-SDK-only.
// `expireAt` is the only Firestore `Timestamp` field (native TTL); every other
// time field is epoch-ms `number`.

import { z } from 'zod';
import type { DeliverySkipReason, DeliveryState } from '@ttt-productions/notification-core/server';
import { NOTIFICATION_FANOUT_PRIORITIES } from '../constants/business-platform.js';

/** Native-TTL Timestamp (set only at the resolved-success terminal). */
const expireAtField = z.unknown().optional();

/** The materialization payload carried on every delivery row.
 *  `actorId` is `null` for system / no-actor occurrences (the engine writes null and
 *  never injects it into `latestActorIds`). */
export const NotificationDeliveryPayloadSchema = z.object({
  actorId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  occurrenceAt: z.number(),
});

/**
 * A delivery row's state: notification-core's `DeliveryState`, whose ledger writes these rows.
 * `skipped` is terminal: the recipient was not eligible for a card when the row materialized (an
 * erased account), so no card was written; a re-run or a replay leaves it.
 */
export const NotificationDeliveryStateSchema = z.enum([
  'queued',
  'materialized',
  'skipped',
  'deadLetter',
] as const satisfies readonly DeliveryState[]);
export type NotificationDeliveryState = z.infer<typeof NotificationDeliveryStateSchema>;

/** Why a delivery row was skipped — notification-core's reasons, which write these rows. */
export const NotificationDeliverySkipReasonSchema = z.enum([
  'recipientIneligible',
] as const satisfies readonly DeliverySkipReason[]);
export type NotificationDeliverySkipReason = z.infer<typeof NotificationDeliverySkipReasonSchema>;

// ── notificationDeliveries/{deliveryId} ─────────────────────────────────────
// BOTH the recipient ledger AND the occurrence ledger. Shared-admin rows set
// recipientUid=null (the deliveryId hash uses the literal 'shared').
export const NotificationDeliverySchema = z
  .object({
    deliveryId: z.string(),
    state: NotificationDeliveryStateSchema,
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
    // Present exactly on a `skipped` row.
    skipReason: NotificationDeliverySkipReasonSchema.optional(),
    skippedAt: z.number().optional(),
    expireAt: expireAtField,
  })
  .superRefine((row, ctx) => {
    const skipped = row.state === 'skipped';
    if (skipped !== (row.skipReason !== undefined) || skipped !== (row.skippedAt !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['state'],
        message: 'skipReason and skippedAt are present exactly on a skipped delivery row.',
      });
    }
  });
export type NotificationDelivery = z.infer<typeof NotificationDeliverySchema>;

// ── notificationFanoutJobs/{jobId} ──────────────────────────────────────────
// jobId = `${eventId}:${notificationType}`. No `running` state (no leases).

/**
 * One phase's audience selector, keyed on `kind`, with the exact arguments that kind
 * needs. A selector missing its target id or its uid list is refused rather than
 * draining to zero recipients.
 */
export const NotificationFanoutPhaseSelectorSchema = z.discriminatedUnion('kind', [
  // Follow-edge selectors: page `followEdges` by target.
  z.object({ kind: z.literal('workFollowers'), workProjectId: z.string().min(1) }),
  z.object({ kind: z.literal('realmFollowers'), workRealmId: z.string().min(1) }),
  z.object({ kind: z.literal('userFollowers'), artisanUid: z.string().min(1) }),
  // Snapshot selectors: page a member list captured in the enqueuing transaction.
  z.object({ kind: z.literal('workMembers'), memberUids: z.array(z.string()) }),
  z.object({ kind: z.literal('userFollowersMany'), memberUids: z.array(z.string()) }),
  // Drain-time member selectors: store only the criterion and read membership when drained.
  z.object({ kind: z.literal('workGuildMembers'), workProjectId: z.string().min(1) }),
  z.object({ kind: z.literal('realmMembers'), workRealmId: z.string().min(1) }),
  // Projection selectors.
  z.object({ kind: z.literal('allArtisans') }),
  z.object({ kind: z.literal('allActiveUsers') }),
  z.object({ kind: z.literal('explicitUids'), uids: z.array(z.string()) }),
]);
export type NotificationFanoutPhaseSelector = z.infer<typeof NotificationFanoutPhaseSelectorSchema>;
export type NotificationFanoutPhaseSelectorKind = NotificationFanoutPhaseSelector['kind'];

/** A document-id cursor; null before the first page and once the phase is exhausted. */
const docIdCursorSchema = z.string().nullable();
/** An offset into the selector's stored uid list. */
const offsetCursorSchema = z.number().int().min(0).nullable();

/** `allArtisans` pages by `(artisanCreator, uid)`, stored as that pair JSON-encoded. */
const allArtisansCursorSchema = z
  .string()
  .nullable()
  .refine(
    (value) => {
      if (value === null) return true;
      try {
        const position = JSON.parse(value) as unknown;
        return (
          typeof position === 'object' &&
          position !== null &&
          typeof (position as Record<string, unknown>).artisanCreator === 'number' &&
          typeof (position as Record<string, unknown>).uid === 'string'
        );
      } catch {
        return false;
      }
    },
    { message: 'allArtisans cursor must be null or JSON {artisanCreator:number, uid:string}' },
  );

/** The cursor shape each selector kind persists. */
const NOTIFICATION_FANOUT_CURSOR_SCHEMA_BY_KIND = {
  workFollowers: docIdCursorSchema,
  realmFollowers: docIdCursorSchema,
  userFollowers: docIdCursorSchema,
  workGuildMembers: docIdCursorSchema,
  allActiveUsers: docIdCursorSchema,
  workMembers: offsetCursorSchema,
  explicitUids: offsetCursorSchema,
  userFollowersMany: z.null().or(
    z.object({
      memberGroupIndex: z.number().int().min(0),
      lastEdgeDocId: z.string().nullable(),
    }),
  ),
  realmMembers: z.null().or(
    z.object({
      workId: z.string().nullable(),
      workCursor: z.string().nullable(),
      memberCursor: z.string().nullable(),
    }),
  ),
  allArtisans: allArtisansCursorSchema,
} as const satisfies Record<NotificationFanoutPhaseSelectorKind, z.ZodType>;

/** One phase: its selector, the durable cursor in that selector's shape, and whether it is done. */
export const NotificationFanoutPhaseSchema = z
  .object({
    selector: NotificationFanoutPhaseSelectorSchema,
    cursor: z.unknown().nullable(),
    done: z.boolean(),
  })
  .superRefine((phase, ctx) => {
    const cursorSchema: z.ZodType = NOTIFICATION_FANOUT_CURSOR_SCHEMA_BY_KIND[phase.selector.kind];
    const result = cursorSchema.safeParse(phase.cursor);
    if (!result.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['cursor'],
        message: `cursor shape invalid for selector kind '${phase.selector.kind}': ${result.error.issues[0]?.message ?? 'wrong type'}`,
      });
    }
  });
export type NotificationFanoutPhase = z.infer<typeof NotificationFanoutPhaseSchema>;

/** A fanout job's priority tier, one of `NOTIFICATION_FANOUT_PRIORITIES`. */
export const NotificationFanoutPrioritySchema = z.literal(NOTIFICATION_FANOUT_PRIORITIES);

const NotificationFanoutJobBaseSchema = z.object({
  jobId: z.string().min(1),
  schemaVersion: z.number(),
  notificationType: z.string().min(1),
  eventId: z.string().min(1),
  priority: NotificationFanoutPrioritySchema,
  payload: z.record(z.string(), z.unknown()),
  phases: z.array(NotificationFanoutPhaseSchema).min(1),
  phaseIndex: z.number().int().min(0),
  revision: z.number().int().min(0),
  status: z.enum(['pending', 'complete', 'deadLetter']),
  attemptCount: z.number().int().min(0),
  nextAttemptAt: z.number(),
  lastError: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
  completedAt: z.number().nullable(),
  deadLetteredAt: z.number().nullable(),
  expireAt: expireAtField,
  // Admin-broadcast replay provenance. These are absent for every other fanout
  // source; together they distinguish an exact retry from request-id reuse.
  requestId: z.string().min(1).optional(),
  actorUid: z.string().min(1).optional(),
  payloadHash: z.string().min(1).optional(),
});

/**
 * The stored fanout job. `phaseIndex` names an existing phase. The three
 * admin-broadcast replay fields form one provenance unit: a job has all of them, or
 * none, since a partial set could not distinguish a safe retry from request-id reuse.
 */
export const NotificationFanoutJobSchema = NotificationFanoutJobBaseSchema.superRefine(
  (job, ctx) => {
    if (job.phaseIndex >= job.phases.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['phaseIndex'],
        message: `phaseIndex ${job.phaseIndex} out of range (phases.length=${job.phases.length})`,
      });
    }
    const fields = ['requestId', 'actorUid', 'payloadHash'] as const;
    const present = fields.filter((field) => job[field] !== undefined);
    if (present.length !== 0 && present.length !== fields.length) {
      for (const field of fields) {
        if (job[field] === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message:
              'Admin-broadcast replay provenance requires requestId, actorUid, and payloadHash together.',
          });
        }
      }
    }
  },
);
export type NotificationFanoutJob = z.infer<typeof NotificationFanoutJobSchema>;
