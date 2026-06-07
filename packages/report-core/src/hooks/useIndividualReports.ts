'use client';

import { where, orderBy } from 'firebase/firestore';
import { useFirestoreCollection } from '@ttt-productions/query-core/react';
import { useReportCoreContext } from '../context/ReportCoreProvider.js';
import type { Report } from '../types.js';

/**
 * Fetch individual reports for a given group key (reportedItemId).
 * Used by admin work views to see all reports against one item.
 */
export function useIndividualReports(groupKey: string | null) {
  const { config } = useReportCoreContext();

  return useFirestoreCollection<Report>({
    collectionPath: config.collections.reports,
    queryKey: ['report-core', 'individualReports', groupKey],
    constraints: groupKey
      ? [where('reportedItemId', '==', groupKey), orderBy('createdAt', 'desc')]
      : [],
    enabled: !!groupKey,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => data as unknown as Report,
  });
}
