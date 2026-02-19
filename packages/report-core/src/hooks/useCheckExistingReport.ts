'use client';

import { collection, query, where, getDocs } from 'firebase/firestore';
import { useReportCoreContext } from '../context/ReportCoreProvider.js';

/**
 * Returns a function to check if the current user already has a
 * pending report for a given item. Used for duplicate prevention.
 */
export function useCheckExistingReport() {
  const { config, db } = useReportCoreContext();

  const checkExisting = async (
    reporterUserId: string,
    reportedItemId: string,
  ): Promise<boolean> => {
    const reportsRef = collection(db, config.collections.reports);
    const q = query(
      reportsRef,
      where('reporterUserId', '==', reporterUserId),
      where('reportedItemId', '==', reportedItemId),
      where('status', '==', 'pending_review'),
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  };

  return { checkExisting };
}
