import { randomUUID } from 'node:crypto';
import type { NotificationSystemConfig, NotificationDoc } from '../types.js';
import type {
  ServerFirestore,
  ServerDocRef,
  ServerTransaction,
} from '@ttt-productions/firebase-helpers/server';
import { buildActiveNotificationDocId } from './activeNotificationId.js';

const DEFAULT_DELIVERIES_PATH = 'notificationDeliveries';
const DEFAULT_DELIVERY_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_COUNT_CAP = 5000;
const DEFAULT_ACTOR_CAP = 5;
const BACKOFF_BASE_MS = 60 * 1000;
const BACKOFF_MAX_MS = 60 * 60 * 1000;

export type DeliveryState = 'queued' | 'materialized' | 'skipped' | 'deadLetter';

export type DeliverySkipReason = 'recipientIneligible';

export interface DeliveryLedgerOptions {
  /** Runs inside the materialize transaction before any write: read through `tx` only (RULE-STD-BACKEND-116). */
  isRecipientEligible: (recipientUid: string, tx: ServerTransaction) => Promise<boolean>;
}
export type AggregationStrategy = 'increment' | 'staticRelight';
export type MaterializationClass = 'directQueued' | 'realtimeFallback' | 'fanoutOrphan' | 'retry';

export interface DeliveryPayload {
  actorId: string | null;
  metadata: Record<string, unknown>;
  occurrenceAt: number;
}

export interface DeliveryRowInput {
  deliveryId: string;
  notificationType: string;
  eventId: string;
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
  allResolved: boolean;
}

export type MaterializeOutcome =
  | 'materialized'
  | 'already-materialized'
  | 'skipped-ineligible-recipient'
  | 'missing'
  | 'skipped-non-queued';

export interface MaterializeManyOptions {
  concurrency?: number;
  onUnrecordedFailure?: (deliveryId: string, error: unknown, details: { cause: unknown }) => void;
}

export type ReplayOutcome = 'replayed' | 'missing' | 'not-dead-lettered';

/** What a replay replaced: the dead-lettered row's attempt count and dead-lettered time, as stored. */
export interface ReplacedDelivery {
  state: 'deadLetter';
  attemptCount: number | null;
  deadLetteredAt: number | null;
}

export interface ReplayOptions {
  auditWrite?: (txn: ServerTransaction, replaced: ReplacedDelivery) => void | Promise<void>;
}

export interface DeliveryLedger {
  enqueue(rows: DeliveryRowInput[]): Promise<EnqueueResult>;
  materialize(deliveryId: string): Promise<MaterializeOutcome>;
  materializeMany(
    deliveryIds: string[],
    options?: MaterializeManyOptions,
  ): Promise<Record<MaterializeOutcome, number>>;
  recordTransientFailure(deliveryId: string, error: unknown): Promise<void>;
  deadLetter(deliveryId: string, error: unknown): Promise<void>;
  replay(deliveryId: string, options?: ReplayOptions): Promise<ReplayOutcome>;
}

function isAlreadyExists(error: unknown): boolean {
  const e = error as { code?: number; message?: string } | undefined;
  return e?.code === 6 || /already.?exists/i.test(e?.message ?? '');
}

function backoffMs(attemptCount: number): number {
  const exp = Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attemptCount - 1), BACKOFF_MAX_MS);
  return Math.floor(exp / 2 + Math.random() * (exp / 2));
}

export function applyAggregation(params: {
  strategy: AggregationStrategy;
  existing: Pick<NotificationDoc, 'count' | 'latestActorIds'> | null;
  actorId: string | null;
  countCap: number;
  actorCap: number;
  buildMessage: (count: number) => string;
  now: number;
  generation: string;
}): {
  count: number;
  latestActorIds: string[];
  message: string;
  activityGeneration: string;
  seenAt: number;
  updatedAt: number;
} {
  const { strategy, existing, actorId, countCap, actorCap, buildMessage, now, generation } = params;
  const prevActors = existing?.latestActorIds ?? [];
  const latestActorIds = actorId
    ? [actorId, ...prevActors.filter((id) => id !== actorId)].slice(0, actorCap)
    : prevActors.slice(0, actorCap);
  const count = strategy === 'staticRelight' ? 1 : Math.min((existing?.count ?? 0) + 1, countCap);
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
  options: DeliveryLedgerOptions,
): DeliveryLedger {
  const { isRecipientEligible } = options;
  const deliveriesPath = config.deliveriesCollectionPath ?? DEFAULT_DELIVERIES_PATH;
  const ttlMs = config.deliveryTtlMs ?? DEFAULT_DELIVERY_TTL_MS;
  const maxAttempts = config.maxDeliveryAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const configTimestampFromMillis = config.timestampFromMillis;
  if (!configTimestampFromMillis) {
    throw new Error(
      '[notification-core] createDeliveryLedger requires config.timestampFromMillis (Firestore TTL needs a real Timestamp for expireAt).',
    );
  }
  // An explicitly non-optional binding: TS does not carry the narrowing into closures called later.
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
    };
  }

  function getTypeConfig(type: string) {
    const typeConfig = config.types[type];
    if (!typeConfig) throw new Error(`[notification-core] Unknown notification type: ${type}`);
    const categoryConfig = config.categories[typeConfig.category];
    if (!categoryConfig)
      throw new Error(`[notification-core] Unknown category: ${typeConfig.category}`);
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
      const error: unknown = s.reason;
      return { deliveryId, outcome: 'failed', error };
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
      if (state === 'skipped') return 'skipped-ineligible-recipient';
      if (state !== 'queued') return 'skipped-non-queued';

      const notificationType = d.notificationType as string;
      const aggregationKey = d.aggregationKey as string;
      const recipientUid = (d.recipientUid as string | null) ?? null;

      if (recipientUid !== null && !(await isRecipientEligible(recipientUid, tx))) {
        const skippedAt = Date.now();
        tx.update(dRef, {
          state: 'skipped' as DeliveryState,
          skipReason: 'recipientIneligible' as DeliverySkipReason,
          skippedAt,
          expireAt: toTimestamp(skippedAt + ttlMs),
        });
        return 'skipped-ineligible-recipient';
      }
      const strategy = (d.strategy as AggregationStrategy) ?? 'increment';
      const payload = (d.payload as DeliveryPayload) ?? {
        actorId: '',
        metadata: {},
        occurrenceAt: Date.now(),
      };
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
      const activeSnap = await tx.get(activeRef); // Firestore transactions take every read before any write.

      const now = Date.now();
      const generation = randomUUID();
      const countCap = typeConfig.countCap ?? DEFAULT_COUNT_CAP;
      const actorCap = typeConfig.actorCap ?? DEFAULT_ACTOR_CAP;
      const buildMessage = (count: number) => typeConfig.messagePattern(payload.metadata, count);
      const title = typeConfig.titlePattern(payload.metadata);
      // Firestore rejects `undefined` values, so a linkless type omits the field.
      const targetPath =
        typeConfig.defaultTargetPath === undefined
          ? undefined
          : typeof typeConfig.defaultTargetPath === 'function'
            ? typeConfig.defaultTargetPath(payload.metadata)
            : typeConfig.defaultTargetPath;
      const targetPathField = targetPath === undefined ? {} : { targetPath };

      if (activeSnap.exists) {
        const existing = (activeSnap.data() ?? {}) as Pick<
          NotificationDoc,
          'count' | 'latestActorIds'
        >;
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
        tx.update(activeRef, { ...delta, title, ...targetPathField, metadata: payload.metadata });
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
        const newDoc: Omit<NotificationDoc, 'id'> = {
          type: notificationType,
          dedupKey: aggregationKey,
          category: typeConfig.category,
          targetUserId: recipientUid,
          title,
          message: delta.message,
          count: delta.count,
          latestActorIds: delta.latestActorIds,
          ...targetPathField,
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
        tx.update(dRef, {
          attemptCount,
          nextAttemptAt: now + backoffMs(attemptCount),
          lastError: message,
          materializationClass: 'retry' as MaterializationClass,
        });
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

  async function replay(deliveryId: string, options?: ReplayOptions): Promise<ReplayOutcome> {
    return db.runTransaction(async (tx): Promise<ReplayOutcome> => {
      const dRef = deliveryRef(deliveryId);
      const dSnap = await tx.get(dRef);
      if (!dSnap.exists) return 'missing';
      const d = (dSnap.data() ?? {}) as Record<string, unknown>;
      if ((d.state as DeliveryState) !== 'deadLetter') return 'not-dead-lettered';
      const replaced: ReplacedDelivery = {
        state: 'deadLetter',
        attemptCount: typeof d.attemptCount === 'number' ? d.attemptCount : null,
        deadLetteredAt: typeof d.deadLetteredAt === 'number' ? d.deadLetteredAt : null,
      };
      tx.update(dRef, {
        state: 'queued' as DeliveryState,
        attemptCount: 0,
        nextAttemptAt: Date.now(),
        lastError: null,
        deadLetteredAt: null,
        expireAt: null,
      });
      await options?.auditWrite?.(tx, replaced);
      return 'replayed';
    });
  }

  function reportUnrecordedFailure(
    options: MaterializeManyOptions | undefined,
    deliveryId: string,
    error: unknown,
    cause: unknown,
  ): void {
    try {
      if (options?.onUnrecordedFailure) {
        options.onUnrecordedFailure(deliveryId, error, { cause });
        return;
      }
    } catch (handlerError) {
      console.error(
        '[notification-core] onUnrecordedFailure threw for delivery',
        deliveryId,
        handlerError,
      );
    }
    console.error(
      '[notification-core] A delivery failure could not be recorded',
      deliveryId,
      error,
      { cause },
    );
  }

  async function materializeMany(
    deliveryIds: string[],
    options?: MaterializeManyOptions,
  ): Promise<Record<MaterializeOutcome, number>> {
    const concurrency = Math.max(1, options?.concurrency ?? 10);
    const tally: Record<MaterializeOutcome, number> = {
      materialized: 0,
      'already-materialized': 0,
      'skipped-ineligible-recipient': 0,
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
          try {
            await recordTransientFailure(id, error);
          } catch (recordError) {
            reportUnrecordedFailure(options, id, recordError, error);
          }
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, deliveryIds.length) }, worker));
    return tally;
  }

  return { enqueue, materialize, materializeMany, recordTransientFailure, deadLetter, replay };
}
