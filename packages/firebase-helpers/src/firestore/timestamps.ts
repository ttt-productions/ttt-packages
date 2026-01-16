import { Timestamp, serverTimestamp } from "firebase/firestore";
import { isSerializedTimestamp, hasToDateMethod } from "./types";

/** Firestore server timestamp field value */
export const serverNow = () => serverTimestamp();

/** Convert Firestore Timestamp -> JS Date (safe for undefined/null) */
export function tsToDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  return ts.toDate();
}

/** Convert Date -> Firestore Timestamp */
export function dateToTs(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

/** Convert ms since epoch -> Firestore Timestamp */
export function msToTs(ms: number): Timestamp {
  return Timestamp.fromMillis(ms);
}

/**
 * Convert any timestamp-like value to milliseconds since epoch.
 * 
 * Handles:
 * - Firestore Timestamp (client SDK)
 * - Objects with toDate() method (duck-typed Timestamps)
 * - Serialized Timestamps from backend ({_seconds, _nanoseconds})
 * - Date objects
 * - ISO date strings
 * - Numbers (returned as-is)
 * 
 * Returns 0 for invalid/null/undefined inputs.
 */
export function toMillis(value: unknown): number {
  if (value === null || value === undefined) return 0;

  // Already a number (milliseconds)
  if (typeof value === "number") return value;

  // Firestore Timestamp with toDate() method (client SDK or duck-typed)
  if (hasToDateMethod(value)) {
    return value.toDate().getTime();
  }

  // Serialized Timestamp from Cloud Functions ({_seconds, _nanoseconds})
  if (isSerializedTimestamp(value)) {
    return value._seconds * 1000 + Math.floor(value._nanoseconds / 1_000_000);
  }

  // Date object
  if (value instanceof Date) {
    return value.getTime();
  }

  // ISO string
  if (typeof value === "string") {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
  }

  // Unknown format
  if (process.env.NODE_ENV !== "production") {
    console.warn("[firebase-helpers] toMillis: unrecognized format", value);
  }
  return 0;
}

/**
 * Convert any timestamp-like value to a JS Date.
 * 
 * Handles same formats as toMillis().
 * Returns Invalid Date for unrecognized formats.
 */
export function toDate(value: unknown): Date {
  if (value === null || value === undefined) {
    return new Date(NaN);
  }

  // Firestore Timestamp with toDate() method
  if (hasToDateMethod(value)) {
    return value.toDate();
  }

  // Serialized Timestamp from backend
  if (isSerializedTimestamp(value)) {
    return new Date(value._seconds * 1000 + Math.floor(value._nanoseconds / 1_000_000));
  }

  // Date object
  if (value instanceof Date) {
    return value;
  }

  // Number (milliseconds)
  if (typeof value === "number") {
    return new Date(value);
  }

  // ISO string
  if (typeof value === "string") {
    return new Date(value);
  }

  // Unknown format
  if (process.env.NODE_ENV !== "production") {
    console.warn("[firebase-helpers] toDate: unrecognized format", value);
  }
  return new Date(NaN);
}

/**
 * Get current time in milliseconds.
 * Use this instead of Date.now() for consistency.
 */
export function now(): number {
  return Date.now();
}
