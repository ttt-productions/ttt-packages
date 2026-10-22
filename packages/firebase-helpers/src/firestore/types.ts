export type WithId<T> = T & { id: string };

export interface SerializedTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

export function isSerializedTimestamp(value: unknown): value is SerializedTimestamp {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_seconds' in value &&
    '_nanoseconds' in value &&
    typeof (value as SerializedTimestamp)._seconds === 'number' &&
    typeof (value as SerializedTimestamp)._nanoseconds === 'number'
  );
}

export function hasToDateMethod(value: unknown): value is { toDate: () => Date } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  );
}
