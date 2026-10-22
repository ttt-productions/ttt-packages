import { format } from 'date-fns';
import { isSerializedTimestamp, hasToDateMethod } from './types.js';

export function toMillis(value: unknown): number {
  if (value === null || value === undefined) return 0;

  if (typeof value === 'number') return value;

  if (hasToDateMethod(value)) {
    return value.toDate().getTime();
  }

  if (isSerializedTimestamp(value)) {
    return value._seconds * 1000 + Math.floor(value._nanoseconds / 1_000_000);
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
  }

  return 0;
}

export function toDate(value: unknown): Date {
  if (value === null || value === undefined) {
    return new Date(NaN);
  }

  if (hasToDateMethod(value)) {
    return value.toDate();
  }

  if (isSerializedTimestamp(value)) {
    return new Date(value._seconds * 1000 + Math.floor(value._nanoseconds / 1_000_000));
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'string') {
    return new Date(value);
  }

  return new Date(NaN);
}

export function now(): number {
  return Date.now();
}

export function formatDate(
  millis: number | undefined | null,
  formatType: 'short' | 'long' = 'short',
): string {
  if (typeof millis !== 'number' || millis === 0) {
    return 'Invalid Date';
  }

  try {
    const date = new Date(millis);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return formatType === 'long'
      ? format(date, "MMM d, yyyy 'at' h:mm a")
      : format(date, 'MMM d, yyyy');
  } catch {
    return 'Invalid Date';
  }
}
