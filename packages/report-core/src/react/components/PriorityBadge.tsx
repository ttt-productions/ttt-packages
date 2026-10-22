'use client';

import { Badge } from '@ttt-productions/ui-core/react';
import { useReportCoreContext } from '../context/ReportCoreProvider.js';
import type { PriorityBadgeProps } from '../types-ui-props.js';

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const { priorityThresholds } = useReportCoreContext();

  const sorted = [...priorityThresholds].sort((a, b) => b.minScore - a.minScore);
  const matched = sorted.find((t) => priority >= t.minScore) ?? {
    label: 'UNKNOWN',
    className: 'rc-priority-unknown',
  };

  return <Badge className={matched.className}>{matched.label}</Badge>;
}
