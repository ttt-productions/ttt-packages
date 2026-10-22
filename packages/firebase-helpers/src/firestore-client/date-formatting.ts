import type { Timestamp } from 'firebase/firestore';
import { format as dateFnsFormat } from 'date-fns';
import type { DateFormat } from '../firestore/date-formatting.js';

export function formatDateDisplay(
  value: Timestamp | Date | string | number | null | undefined,
  formatStr: DateFormat = 'PPP',
  fallback: string = 'Unknown',
): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  let date: Date | null = null;

  if (value instanceof Date) {
    date = value;
  } else if (value && typeof value === 'object' && 'toDate' in value) {
    date = (value as Timestamp).toDate();
  } else if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    date = isNaN(parsed.getTime()) ? null : parsed;
  }

  if (!date) {
    return fallback;
  }

  try {
    return dateFnsFormat(date, formatStr);
  } catch (error) {
    console.error('Date formatting error:', error);
    return fallback;
  }
}
