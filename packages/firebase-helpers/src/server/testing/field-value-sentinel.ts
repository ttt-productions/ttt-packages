import { vi } from 'vitest';
import type { FieldValue } from 'firebase-admin/firestore';

type FieldValueStatics = (typeof import('firebase-admin/firestore'))['FieldValue'];

function notInFieldValueFake(what: string): () => never {
  return () => {
    throw new Error(`FieldValue.${what} is not part of the in-memory Firestore fake`);
  };
}

export type FieldValueSentinelKind =
  'deleteField' | 'increment' | 'arrayUnion' | 'arrayRemove' | 'serverTimestamp';

export class FieldValueSentinel implements FieldValue {
  private constructor(
    readonly _type: FieldValueSentinelKind = 'deleteField',
    readonly value?: number,
    readonly items?: unknown[],
  ) {}

  static increment = vi.fn<FieldValueStatics['increment']>(
    (n) => new FieldValueSentinel('increment', n),
  );
  static arrayUnion = vi.fn<FieldValueStatics['arrayUnion']>(
    (...items: unknown[]) => new FieldValueSentinel('arrayUnion', undefined, items),
  );
  static arrayRemove = vi.fn<FieldValueStatics['arrayRemove']>(
    (...items: unknown[]) => new FieldValueSentinel('arrayRemove', undefined, items),
  );
  static serverTimestamp = vi.fn<FieldValueStatics['serverTimestamp']>(
    () => new FieldValueSentinel('serverTimestamp'),
  );
  static delete = vi.fn<FieldValueStatics['delete']>(() => new FieldValueSentinel('deleteField'));
  static minimum = notInFieldValueFake('minimum');
  static maximum = notInFieldValueFake('maximum');
  static vector = notInFieldValueFake('vector');

  isEqual(other: FieldValue): boolean {
    return other instanceof FieldValueSentinel && JSON.stringify(other) === JSON.stringify(this);
  }
}

export const fieldValueSentinels: FieldValueStatics = FieldValueSentinel;
