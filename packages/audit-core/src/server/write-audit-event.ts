import type { AuditEvent } from '../types.js';

import type {
  ServerFirestore,
  ServerTransaction,
  ServerWriteBatch,
} from '@ttt-productions/firebase-helpers/server';

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
  batch?: ServerWriteBatch;
  transaction?: ServerTransaction;
}

export interface AuditWriterConfig {
  db: ServerFirestore;
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
    const doc = { ...event };
    if (args.transaction) {
      args.transaction.set(ref, doc);
    } else if (args.batch) {
      args.batch.set(ref, doc);
    } else {
      await ref.set(doc);
    }
    return id;
  }

  return { writeAuditEvent };
}
