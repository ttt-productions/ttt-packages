'use client';

import { Badge } from '@ttt-productions/ui-core';
import { useReportCoreContext } from '../context/ReportCoreProvider.js';
import type { PriorityBadgeProps } from '../types.js';

/**
 * Displays a priority badge based on the numeric priority score.
 * Uses thresholds from ReportCoreProvider config (or defaults).
 *
 * Score thresholds (defaults):
 *  >= 800 → CRITICAL (red, pulsing)
 *  >= 300 → HIGH (yellow)
 *  >= 100 → NORMAL (blue)
 *  < 100  → LOW (gray)
 */
export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const { priorityThresholds } = useReportCoreContext();

  // Find the first threshold that matches (thresholds are sorted high → low)
  const sorted = [...priorityThresholds].sort((a, b) => b.minScore - a.minScore);
  const matched = sorted.find((t) => priority >= t.minScore) ?? {
    label: 'UNKNOWN',
    className: 'rc-priority-unknown',
  };

  return <Badge className={matched.className}>{matched.label}</Badge>;
}
