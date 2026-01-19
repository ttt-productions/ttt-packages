import type { Firestore, WriteBatch } from "firebase-admin/firestore";
import { chunk } from "../utils/chunk.js";

/**
 * Admin SDK version of BatchApplyFn
 */
export type BatchApplyFn<T> = (batch: WriteBatch, item: T) => void | Promise<void>;

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
): Promise<{ committedBatches: number; committedOps: number }> {
  const batchSize = opts.batchSize ?? 450;
  const groups = chunk(items, batchSize);
  let committedBatches = 0;
  let committedOps = 0;

  for (const group of groups) {
    const b = db.batch();
    for (const item of group) {
      await opts.apply(b, item);
    }
    await b.commit();
    committedBatches += 1;
    committedOps += group.length;
  }

  return { committedBatches, committedOps };
}