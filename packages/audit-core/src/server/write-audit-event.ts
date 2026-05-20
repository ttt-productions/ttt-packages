import type { AuditEvent } from "../types.js";

// Type-only imports — no firebase-admin runtime initialization in this package.
// The consumer supplies the live Firestore instance.
import type { Firestore, WriteBatch, Transaction } from "firebase-admin/firestore";

type FirestoreLike = Firestore;
type BatchLike = WriteBatch;
type TransactionLike = Transaction;

export interface WriteAuditEventArgs<
  TEventType extends string,
  TActor,
  TTarget,
  TMetadata,
> {
  type: TEventType;
  actor: TActor | null;
  target?: TTarget | null;
  metadata?: TMetadata;
  result?: "success" | "failure";
  failureReason?: string | null;
  correlationId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  region?: string | null;
  schemaVersion?: number;
  /** Optional batch — write is added to this batch instead of committing immediately. */
  batch?: BatchLike;
  /** Optional transaction — write is added to this transaction instead of committing. */
  transaction?: TransactionLike;
}

export interface AuditWriterConfig {
  /** Live Firestore instance. */
  db: FirestoreLike;
  /** Collection path where audit events are written (e.g. "auditEvents"). */
  collectionPath: string;
  /** Default schemaVersion applied when args don't override. Default: 1. */
  defaultSchemaVersion?: number;
  /** Override the id generator (for testing). Default: crypto.randomUUID(). */
  idGenerator?: () => string;
}

/**
 * Build an `writeAuditEvent` function bound to a Firestore + collection path.
 * The generic parameters allow consumers to lock the event-type catalog,
 * actor/target/metadata shapes once and get full type-safety at every call site.
 */
export function createAuditWriter<
  TEventType extends string = string,
  TActor = string,
  TTarget = string,
  TMetadata = Record<string, unknown>,
>(config: AuditWriterConfig) {
  const {
    db,
    collectionPath,
    defaultSchemaVersion = 1,
    idGenerator = () => crypto.randomUUID(),
  } = config;

  async function writeAuditEvent(
    args: WriteAuditEventArgs<TEventType, TActor, TTarget, TMetadata>,
  ): Promise<string> {
    if (args.batch && args.transaction) {
      throw new Error(
        "writeAuditEvent: pass either batch or transaction, not both.",
      );
    }

    const id = idGenerator();
    const event: AuditEvent<TEventType, TActor, TTarget, TMetadata> = {
      id,
      type: args.type,
      schemaVersion: args.schemaVersion ?? defaultSchemaVersion,
      actor: args.actor,
      target: args.target ?? null,
      timestamp: Date.now(),
      ip: args.ip ?? null,
      userAgent: args.userAgent ?? null,
      region: args.region ?? null,
      metadata: (args.metadata ?? ({} as TMetadata)) as TMetadata,
      result: args.result ?? "success",
      failureReason: args.failureReason ?? null,
      correlationId: args.correlationId ?? null,
    };

    const ref = db.collection(collectionPath).doc(id);
    if (args.transaction) {
      args.transaction.set(ref, event as unknown as Record<string, unknown>);
    } else if (args.batch) {
      args.batch.set(ref, event as unknown as Record<string, unknown>);
    } else {
      await ref.set(event as unknown as Record<string, unknown>);
    }
    return id;
  }

  return { writeAuditEvent };
}
