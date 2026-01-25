import { Timestamp } from "firebase/firestore";
import { format as dateFnsFormat } from "date-fns";
import { tsToDate } from "./timestamps.js";

export type DateFormat = 
  | "PPP"           // Jan 1, 2024
  | "PPpp"          // Jan 1, 2024, 12:00 PM
  | "MM/dd/yyyy"    // 01/01/2024
  | "yyyy-MM-dd"    // 2024-01-01
  | "MMM d, yyyy"   // Jan 1, 2024
  | "MMMM d, yyyy"  // January 1, 2024
  | "h:mm a"        // 12:00 PM
  | "HH:mm"         // 13:00
  | string;         // Allow custom format strings

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
  formatStr: DateFormat = "PPP",
  fallback: string = "Unknown"
): string {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return fallback;
  }

  let date: Date | null = null;

  // Already a Date
  if (value instanceof Date) {
    date = value;
  }
  // Firestore Timestamp
  else if (value && typeof value === "object" && "toDate" in value) {
    date = tsToDate(value as Timestamp);
  }
  // String or number
  else if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    date = isNaN(parsed.getTime()) ? null : parsed;
  }

  // Format or return fallback
  if (!date) {
    return fallback;
  }

  try {
    return dateFnsFormat(date, formatStr);
  } catch (error) {
    console.error("Date formatting error:", error);
    return fallback;
  }
}