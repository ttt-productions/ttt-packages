'use client';

import { useQuery } from '@tanstack/react-query';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useReportCoreContext } from '../context/ReportCoreProvider.js';
import type { Report } from '../types.js';

/**
 * Fetch individual reports for a given group key (reportedItemId).
 * Used by admin work views to see all reports against one item.
 */
export function useIndividualReports(groupKey: string | null) {
  const { config, db } = useReportCoreContext();

  return useQuery<Report[], Error>({
    queryKey: ['report-core', 'individualReports', groupKey],
    queryFn: async () => {
      if (!groupKey) return [];

      const reportsRef = collection(db, config.collections.reports);
      const q = query(
        reportsRef,
        where('reportedItemId', '==', groupKey),
        orderBy('createdAt', 'desc'),
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          ...data,
          createdAt: data.createdAt,
        } as Report;
      });
    },
    enabled: !!groupKey,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
