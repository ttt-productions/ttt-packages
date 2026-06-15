/**
 * Generic notification delivery ledger (notification redesign — P1).
 *
 * One Firestore doc per (recipient|shared, type, occurrence) is BOTH the queue
 * row AND the idempotency ledger. This package owns the GENERIC mechanism;
 * the consuming app owns the concrete collection name, the deterministic
 * `deliveryId`/`eventId`/`aggregationKey` construction, and the worker that
 * selects rows per `materializationClass`. The app passes fully-formed
 * `DeliveryRowInput`s; this module never invents domain ids.
 *
 * Key invariants (frozen in NOTIFICATIONS_REDESIGN):
 *  - Enqueue = create-if-absent. `ALREADY_EXISTS` is a per-row duplicate no-op,
 *    never a failure — there is no marker-without-payload state, so the
 *    "marker created, payload lost" crash window cannot exist.
 *  - Materialize = ONE transaction that reads the delivery row + active card,
 *    applies the aggregation exactly once (per strategy + caps), rotates the
 *    opaque `activityGeneration`, resets `seenAt`, and flips the row to
 *    `materialized` — so the "applied but not marked" double-apply window is gone.
 *    Retrying a `materialized` row is a successful no-op.
 *  - TTL (`expireAt`, a real Firestore Timestamp via `config.timestampFromMillis`)
 *    is set ONLY at `materialized`; a `queued` or `deadLetter` row is NEVER TTL'd
 *    (round-19) so an unresolved delivery can't be silently deleted before replay.
 */

import { randomUUID } from 'node:crypto';
import type { NotificationSystemConfig, NotificationDoc } from '../types.js';
import type { ServerFirestore, ServerDocRef } from './types.js';
import { buildActiveNotificationDocId } from './activeNotificationId.js';

const DEFAULT_DELIVERIES_PATH = 'notificationDeliveries';
const DEFAULT_DELIVERY_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_COUNT_CAP = 5000;
const DEFAULT_ACTOR_CAP = 5;
const BACKOFF_BASE_MS = 60 * 1000; // 1 min
const BACKOFF_MAX_MS = 60 * 60 * 1000; // 1 hour

export type DeliveryState = 'queued' | 'materialized' | 'deadLetter';
export type AggregationStrategy = 'increment' | 'staticRelight';
export type MaterializationClass =
  | 'directQueued'
  | 'realtimeFallback'
  | 'fanoutOrphan'
  | 'retry';

/** The materialization payload carried on every delivery row. */
export interface DeliveryPayload {
  actorId: string;
  metadata: Record<string, unknown>;
  occurrenceAt: number;
}

/** App-supplied, fully-formed delivery row (the app owns all id construction). */
export interface DeliveryRowInput {
  deliveryId: string;
  notificationType: string;
  eventId: string;
  /** `null` for shared-admin occurrences (the deliveryId hash uses the literal `'shared'`). */
  recipientUid: string | null;
  aggregationKey: string;
  strategy: AggregationStrategy;
  payload: DeliveryPayload;
  payloadVersion: number;
  materializationClass: MaterializationClass;
}

export type EnqueueRowResult =
  | { deliveryId: string; outcome: 'created' }
  | { deliveryId: string; outcome: 'duplicate' }
  | { deliveryId: string; outcome: 'failed'; error: unknown };

export interface EnqueueResult {
  results: EnqueueRowResult[];
  /** True iff EVERY row is now represented by a created-or-pre-existing doc (page-cursor invariant input). */
  allResolved: boolean;
}

export type MaterializeOutcome =
  | 'materialized'
  | 'already-materialized'
  | 'missing'
  | 'skipped-non-queued';

export interface DeliveryLedger {
  enqueue(rows: DeliveryRowInput[]): Promise<EnqueueResult>;
  materialize(deliveryId: string): Promise<MaterializeOutcome>;
  /** Materialize many rows with bounded concurrency; transient throws record a retry/dead-letter outcome. */
  materializeMany(deliveryIds: string[], options?: { concurrency?: number }): Promise<Record<MaterializeOutcome, number>>;
  recordTransientFailure(deliveryId: string, error: unknown): Promise<void>;
  deadLetter(deliveryId: string, error: unknown): Promise<void>;
  replay(deliveryId: string): Promise<void>;
}

/** gRPC ALREADY_EXISTS (6) — the create-if-absent duplicate signal. */
function isAlreadyExists(error: unknown): boolean {
  const e = error as { code?: number; message?: string } | undefined;
  return e?.code === 6 || /already.?exists/i.test(e?.message ?? '');
}

function backoffMs(attemptCount: number): number {
  const exp = Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attemptCount - 1), BACKOFF_MAX_MS);
  // Full jitter — spread retries so a burst of failures doesn't synchronize.
  return Math.floor(exp / 2 + Math.random() * (exp / 2));
}

/**
 * Apply the aggregation strategy to produce the active-doc field delta.
 * PURE — exported for direct unit testing. `existing` is the current active doc
 * (or null to create). Always rotates `activityGeneration` and resets `seenAt`.
 */
export function applyAggregation(params: {
  strategy: AggregationStrategy;
  existing: Pick<NotificationDoc, 'count' | 'latestActorIds'> | null;
  actorId: string;
  countCap: number;
  actorCap: number;
  buildMessage: (count: number) => string;
  now: number;
  generation: string;
}): { count: number; latestActorIds: string[]; message: string; activityGeneration: string; seenAt: number; updatedAt: number } {
  const { strategy, existing, actorId, countCap, actorCap, buildMessage, now, generation } = params;
  const prevActors = existing?.latestActorIds ?? [];
  const latestActorIds = [actorId, ...prevActors.filter((id) => id !== actorId)].slice(0, actorCap);
  // staticRelight never shows a count (stays 1); increment counts up to the cap.
  const count =
    strategy === 'staticRelight'
      ? 1
      : Math.min((existing?.count ?? 0) + 1, countCap);
  return {
    count,
    latestActorIds,
    message: buildMessage(count),
    activityGeneration: generation,
    seenAt: 0,
    updatedAt: now,
  };
}

export function createDeliveryLedger(
  db: ServerFirestore,
  config: NotificationSystemConfig,
): DeliveryLedger {
  const deliveriesPath = config.deliveriesCollectionPath ?? DEFAULT_DELIVERIES_PATH;
  const ttlMs = config.deliveryTtlMs ?? DEFAULT_DELIVERY_TTL_MS;
  const maxAttempts = config.maxDeliveryAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const configTimestampFromMillis = config.timestampFromMillis;
  if (!configTimestampFromMillis) {
    throw new Error(
      '[notification-core] createDeliveryLedger requires config.timestampFromMillis (Firestore TTL needs a real Timestamp for expireAt).',
    );
  }
  // Bind to an explicitly non-optional type so the nested transaction closures
  // (called later) see it as defined, not `... | undefined`.
  const toTimestamp: (ms: number) => unknown = configTimestampFromMillis;

  const deliveries = db.collection(deliveriesPath);

  function deliveryRef(deliveryId: string): ServerDocRef {
    return deliveries.doc(deliveryId);
  }

  function buildDeliveryDoc(row: DeliveryRowInput, now: number): Record<string, unknown> {
    return {
      deliveryId: row.deliveryId,
      state: 'queued' as DeliveryState,
      notificationType: row.notificationType,
      eventId: row.eventId,
      recipientUid: row.recipientUid,
      aggregationKey: row.aggregationKey,
      strategy: row.strategy,
      payload: row.payload,
      payloadVersion: row.payloadVersion,
      materializationClass: row.materializationClass,
      attemptCount: 0,
      nextAttemptAt: now,
      lastError: null,
      createdAt: now,
      materializedAt: null,
      deadLetteredAt: null,
      // No expireAt while queued (round-19).
    };
  }

  function getTypeConfig(type: string) {
    const typeConfig = config.types[type];
    if (!typeConfig) throw new Error(`[notification-core] Unknown notification type: ${type}`);
    const categoryConfig = config.categories[typeConfig.category];
    if (!categoryConfig) throw new Error(`[notification-core] Unknown category: ${typeConfig.category}`);
    return { typeConfig, categoryConfig };
  }

  async function enqueue(rows: DeliveryRowInput[]): Promise<EnqueueResult> {
    if (rows.length === 0) return { results: [], allResolved: true };
    const now = Date.now();
    const settled = await Promise.allSettled(
      rows.map((row) =>
        deliveryRef(row.deliveryId)
          .create(buildDeliveryDoc(row, now))
          .then(() => ({ deliveryId: row.deliveryId, outcome: 'created' as const })),
      ),
    );
    const results: EnqueueRowResult[] = settled.map((s, i) => {
      const deliveryId = rows[i].deliveryId;
      if (s.status === 'fulfilled') return s.value;
      if (isAlreadyExists(s.reason)) return { deliveryId, outcome: 'duplicate' };
      return { deliveryId, outcome: 'failed', error: s.reason };
    });
    return { results, allResolved: results.every((r) => r.outcome !== 'failed') };
  }

  async function materialize(deliveryId: string): Promise<MaterializeOutcome> {
    return db.runTransaction(async (tx) => {
      const dRef = deliveryRef(deliveryId);
      const dSnap = await tx.get(dRef);
      if (!dSnap.exists) return 'missing';
      const d = (dSnap.data() ?? {}) as Record<string, unknown>;
      const state = d.state as DeliveryState;
      if (state === 'materialized') return 'already-materialized';
      if (state !== 'queued') return 'skipped-non-queued';

      const notificationType = d.notificationType as string;
      const aggregationKey = d.aggregationKey as string;
      const recipientUid = (d.recipientUid as string | null) ?? null;
      const strategy = (d.strategy as AggregationStrategy) ?? 'increment';
      const payload = (d.payload as DeliveryPayload) ?? { actorId: '', metadata: {}, occurrenceAt: Date.now() };
      const { typeConfig, categoryConfig } = getTypeConfig(notificationType);

      const activeRef = db.collection(categoryConfig.activePath).doc(
        buildActiveNotificationDocId({
          category: typeConfig.category,
          audienceType: categoryConfig.audienceType,
          targetUserId: recipientUid,
          dedupKey: aggregationKey,
          notificationType,
        }),
      );
      const activeSnap = await tx.get(activeRef); // all reads before writes

      const now = Date.now();
      const generation = randomUUID();
      const countCap = typeConfig.countCap ?? DEFAULT_COUNT_CAP;
      const actorCap = typeConfig.actorCap ?? DEFAULT_ACTOR_CAP;
      const buildMessage = (count: number) => typeConfig.messagePattern(payload.metadata, count);

      if (activeSnap.exists) {
        const existing = (activeSnap.data() ?? {}) as Pick<NotificationDoc, 'count' | 'latestActorIds'>;
        const delta = applyAggregation({
          strategy,
          existing,
          actorId: payload.actorId,
          countCap,
          actorCap,
          buildMessage,
          now,
          generation,
        });
        tx.update(activeRef, { ...delta });
      } else {
        const delta = applyAggregation({
          strategy,
          existing: null,
          actorId: payload.actorId,
          countCap,
          actorCap,
          buildMessage,
          now,
          generation,
        });
        const targetPath =
          typeof typeConfig.defaultTargetPath === 'function'
            ? typeConfig.defaultTargetPath(payload.metadata)
            : typeConfig.defaultTargetPath;
        const newDoc: Omit<NotificationDoc, 'id'> = {
          type: notificationType,
          dedupKey: aggregationKey,
          category: typeConfig.category,
          targetUserId: recipientUid,
          title: typeConfig.titlePattern(payload.metadata),
          message: delta.message,
          count: delta.count,
          latestActorIds: delta.latestActorIds,
          targetPath,
          metadata: payload.metadata,
          seenAt: 0,
          activityGeneration: generation,
          createdAt: now,
          updatedAt: now,
        };
        tx.set(activeRef, newDoc as Record<string, unknown>);
      }

      tx.update(dRef, {
        state: 'materialized' as DeliveryState,
        materializedAt: now,
        expireAt: toTimestamp(now + ttlMs),
      });
      return 'materialized';
    });
  }

  async function recordTransientFailure(deliveryId: string, error: unknown): Promise<void> {
    await db.runTransaction(async (tx) => {
      const dRef = deliveryRef(deliveryId);
      const dSnap = await tx.get(dRef);
      if (!dSnap.exists) return;
      const d = (dSnap.data() ?? {}) as Record<string, unknown>;
      if ((d.state as DeliveryState) !== 'queued') return;
      const attemptCount = ((d.attemptCount as number) ?? 0) + 1;
      const now = Date.now();
      const message = error instanceof Error ? error.message : String(error);
      if (attemptCount >= maxAttempts) {
        tx.update(dRef, {
          state: 'deadLetter' as DeliveryState,
          attemptCount,
          lastError: message,
          deadLetteredAt: now,
        });
      } else {
        tx.update(dRef, { attemptCount, nextAttemptAt: now + backoffMs(attemptCount), lastError: message });
      }
    });
  }

  async function deadLetter(deliveryId: string, error: unknown): Promise<void> {
    await db.runTransaction(async (tx) => {
      const dRef = deliveryRef(deliveryId);
      const dSnap = await tx.get(dRef);
      if (!dSnap.exists) return;
      const d = (dSnap.data() ?? {}) as Record<string, unknown>;
      if ((d.state as DeliveryState) !== 'queued') return;
      tx.update(dRef, {
        state: 'deadLetter' as DeliveryState,
        attemptCount: ((d.attemptCount as number) ?? 0) + 1,
        lastError: error instanceof Error ? error.message : String(error),
        deadLetteredAt: Date.now(),
      });
    });
  }

  async function replay(deliveryId: string): Promise<void> {
    await db.runTransaction(async (tx) => {
      const dRef = deliveryRef(deliveryId);
      const dSnap = await tx.get(dRef);
      if (!dSnap.exists) return;
      const d = (dSnap.data() ?? {}) as Record<string, unknown>;
      if ((d.state as DeliveryState) !== 'deadLetter') return;
      tx.update(dRef, {
        state: 'queued' as DeliveryState,
        attemptCount: 0,
        nextAttemptAt: Date.now(),
        lastError: null,
        deadLetteredAt: null,
        expireAt: null, // clear any TTL set on a prior terminal (round-19)
      });
    });
  }

  async function materializeMany(
    deliveryIds: string[],
    options?: { concurrency?: number },
  ): Promise<Record<MaterializeOutcome, number>> {
    const concurrency = Math.max(1, options?.concurrency ?? 10);
    const tally: Record<MaterializeOutcome, number> = {
      materialized: 0,
      'already-materialized': 0,
      missing: 0,
      'skipped-non-queued': 0,
    };
    let cursor = 0;
    async function worker(): Promise<void> {
      while (cursor < deliveryIds.length) {
        const id = deliveryIds[cursor++];
        try {
          const outcome = await materialize(id);
          tally[outcome] += 1;
        } catch (error) {
          await recordTransientFailure(id, error);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, deliveryIds.length) }, worker));
    return tally;
  }

  return { enqueue, materialize, materializeMany, recordTransientFailure, deadLetter, replay };
}
