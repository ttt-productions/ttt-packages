import type { Firestore, DocumentData, DocumentReference } from 'firebase/firestore';
import { writeBatch } from 'firebase/firestore';
import { chunk } from '../utils/chunk.js';

export type BatchApplyFn<T> = (
  batch: ReturnType<typeof writeBatch>,
  item: T,
) => void | Promise<void>;

export interface CommitInBatchesResult {
  committedBatches: number;
  committedOps: number;
  totalBatches: number;
  totalOps: number;
  success: boolean;
  error?: unknown;
}

export async function commitInBatches<T>(
  db: Firestore,
  items: T[],
  opts: {
    batchSize?: number;
    apply: BatchApplyFn<T>;
  },
): Promise<CommitInBatchesResult> {
  const batchSize = opts.batchSize ?? 450; // Firestore caps a writeBatch at 500 operations.
  const groups = chunk(items, batchSize);

  let committedBatches = 0;
  let committedOps = 0;
  const totalBatches = groups.length;
  const totalOps = items.length;

  try {
    for (const group of groups) {
      const b = writeBatch(db);
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

export async function batchSet<T extends DocumentData>(
  db: Firestore,
  items: Array<{ ref: DocumentReference<T>; data: T; merge?: boolean }>,
  opts?: { batchSize?: number },
): Promise<CommitInBatchesResult> {
  const result = await commitInBatches(db, items, {
    batchSize: opts?.batchSize,
    apply: (b, item) => {
      if (item.merge) {
        b.set(item.ref, item.data, { merge: true });
      } else {
        b.set(item.ref, item.data);
      }
    },
  });

  if (!result.success) {
    console.error(
      `[batchSet] Partial failure: ${result.committedOps}/${result.totalOps} operations committed`,
      result.error,
    );
  }

  return result;
}
