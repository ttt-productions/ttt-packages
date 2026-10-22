'use client';

import * as React from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { toDate } from '@ttt-productions/firebase-helpers';

export interface RelativeTimeProps {
  timestamp: number | string | Date | undefined | null;
  placeholder?: string;
  fallback?: string;
  refreshIntervalMs?: number;
}

export function RelativeTime({
  timestamp,
  placeholder = '...',
  fallback = 'a while ago',
  refreshIntervalMs = 60_000,
}: RelativeTimeProps) {
  const [value, setValue] = React.useState<string>(placeholder);

  React.useEffect(() => {
    let date: Date | null = null;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'number') {
      date = toDate(timestamp);
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
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
