"use client";

import * as React from "react";
import { formatDistanceToNowStrict, toDate } from "@ttt-productions/firebase-helpers";

export interface RelativeTimeProps {
  /** Number (ms or seconds), ISO string, Firestore Timestamp, or Date. */
  timestamp: number | string | Date | undefined | null;
  /** Fallback rendered before client hydration completes. Defaults to "...". */
  placeholder?: string;
  /** Fallback rendered when the timestamp can't be parsed. Defaults to "a while ago". */
  fallback?: string;
  /** Auto-refresh interval in ms. Defaults to 60000. Set to 0 to disable. */
  refreshIntervalMs?: number;
}

/**
 * SSR-safe relative-time component.
 * Renders `placeholder` on the server and pre-mount, then the live value.
 */
export function RelativeTime({
  timestamp,
  placeholder = "...",
  fallback = "a while ago",
  refreshIntervalMs = 60_000,
}: RelativeTimeProps) {
  const [value, setValue] = React.useState<string>(placeholder);

  React.useEffect(() => {
    let date: Date | null = null;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === "number") {
      date = toDate(timestamp);
    } else if (typeof timestamp === "string") {
      date = new Date(timestamp);
    } else if (timestamp && typeof timestamp === "object" && "toDate" in timestamp) {
      date = toDate(timestamp);
    }

    if (!date || isNaN(date.getTime())) {
      setValue(fallback);
      return;
    }

    setValue(formatDistanceToNowStrict(date, { addSuffix: true }));

    if (refreshIntervalMs <= 0) return;
    const interval = setInterval(() => {
      setValue(formatDistanceToNowStrict(date, { addSuffix: true }));
    }, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [timestamp, fallback, refreshIntervalMs]);

  return <>{value}</>;
}
