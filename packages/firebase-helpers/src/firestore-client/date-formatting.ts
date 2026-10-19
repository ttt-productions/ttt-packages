import type { Timestamp } from 'firebase/firestore';
import { format as dateFnsFormat } from 'date-fns';
import type { DateFormat } from '../firestore/date-formatting.js';

/**
 * Format any date-like value for display
 * Handles Firestore Timestamps, Date objects, strings, and numbers
 *
 * @param value - Date value in any format (Timestamp, Date, string, number)
 * @param formatStr - date-fns format string (default: "PPP" = "Jan 1, 2024")
 * @param fallback - Fallback string if conversion fails (default: "Unknown")
 * @returns Formatted date string
 */
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
  }
  // Firestore Timestamp (duck-typed — works for both Client and Admin SDKs
  // without importing the client SDK at runtime).
  else if (value && typeof value === 'object' && 'toDate' in value) {
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
