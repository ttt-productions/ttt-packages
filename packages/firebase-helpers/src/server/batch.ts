import type { DocumentReference, Firestore, WriteBatch } from "firebase-admin/firestore";
import { chunk } from "../utils/chunk.js";

/**
 * The minimal create-only write surface shared by `WriteBatch`, `Transaction`, and any test
 * double standing in for them: a single `create(ref, data)` call.
 *
 * `create()` THROWS if the document already exists, where `set()` silently overwrites — so a
 * helper that accepts a `CreateOnlyWriter` cannot clobber an existing document by accident,
 * and its callers may hand it either a batch or a transaction without the helper caring which.
 */
export interface CreateOnlyWriter {
  create(ref: DocumentReference, data: Record<string, unknown>): unknown;
}

/**
 * Admin SDK version of BatchApplyFn
 */
export type BatchApplyFn<T> = (batch: WriteBatch, item: T) => void | Promise<void>;

export interface CommitInBatchesResult {
  committedBatches: number;
  committedOps: number;
  totalBatches: number;
  totalOps: number;
  success: boolean;
  error?: unknown;
}

/**
 * Admin SDK version of commitInBatches.
 * Uses `db.batch()` instead of `writeBatch(db)`.
 */
export async function commitInBatches<T>(
  db: Firestore,
  items: T[],
  opts: {
    batchSize?: number;
    apply: BatchApplyFn<T>;
  }
): Promise<CommitInBatchesResult> {
  const batchSize = opts.batchSize ?? 450;
  const groups = chunk(items, batchSize);

  let committedBatches = 0;
  let committedOps = 0;
  const totalBatches = groups.length;
  const totalOps = items.length;

  try {
    for (const group of groups) {
      const b = db.batch();
      for (const item of group) {
        await opts.apply(b, item);
      }
      await b.commit();
      committedBatches += 1;
      committedOps += group.length;
    }

    return {
      committedBatches,
      committedOps,
      totalBatches,
      totalOps,
      success: true,
    };
  } catch (error) {
    return {
      committedBatches,
      committedOps,
      totalBatches,
      totalOps,
      success: false,
      error,
    };
  }
}