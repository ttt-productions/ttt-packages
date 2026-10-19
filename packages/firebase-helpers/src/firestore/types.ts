export type WithId<T> = T & { id: string };

/**
 * Serialized Firestore Timestamp format.
 * This is what you get when a Timestamp is JSON-serialized from Cloud Functions.
 */
export interface SerializedTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

/**
 * Type guard: checks if value is a SerializedTimestamp from Cloud Functions
 */
export function isSerializedTimestamp(value: unknown): value is SerializedTimestamp {
  return (
    typeof value === "object" &&
    value !== null &&
    "_seconds" in value &&
    "_nanoseconds" in value &&
    typeof (value as SerializedTimestamp)._seconds === "number" &&
    typeof (value as SerializedTimestamp)._nanoseconds === "number"
  );
}

/**
 * Type guard: checks if value has a toDate() method (duck typing for Timestamp)
 */
export function hasToDateMethod(value: unknown): value is { toDate: () => Date } {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  );
}
