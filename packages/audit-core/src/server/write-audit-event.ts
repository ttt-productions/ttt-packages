import type { AuditEvent } from '../types.js';

import type { Firestore, WriteBatch, Transaction } from 'firebase-admin/firestore';

type FirestoreLike = Firestore;
type BatchLike = WriteBatch;
type TransactionLike = Transaction;

export interface WriteAuditEventArgs<TEventType extends string, TActor, TTarget, TMetadata> {
  type: TEventType;
  actor: TActor | null;
  target?: TTarget | null;
  metadata?: TMetadata;
  result?: 'success' | 'failure';
  failureReason?: string | null;
  correlationId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  region?: string | null;
  schemaVersion?: number;
  batch?: BatchLike;
  transaction?: TransactionLike;
}

export interface AuditWriterConfig {
  db: FirestoreLike;
  collectionPath: string;
  defaultSchemaVersion?: number;
  idGenerator?: () => string;
}

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
      throw new Error('writeAuditEvent: pass either batch or transaction, not both.');
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
      metadata: args.metadata ?? ({} as TMetadata),
      result: args.result ?? 'success',
      failureReason: args.failureReason ?? null,
      correlationId: args.correlationId ?? null,
    };

    const ref = db.collection(collectionPath).doc(id);
    if (args.transaction) {
      args.transaction.set(ref, event);
    } else if (args.batch) {
      args.batch.set(ref, event);
    } else {
      await ref.set(event);
    }
    return id;
  }

  return { writeAuditEvent };
}
