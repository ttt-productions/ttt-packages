'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { ReportCoreConfig, PriorityThreshold } from '../config.js';
import { DEFAULT_PRIORITY_THRESHOLDS } from '../config.js';

// ============================================
// CONTEXT
// ============================================

export interface ReportCoreContextValue {
  config: ReportCoreConfig;
  db: Firestore;
  /** Resolved priority thresholds (from config or defaults) */
  priorityThresholds: PriorityThreshold[];
}

const ReportCoreContext = createContext<ReportCoreContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

export interface ReportCoreProviderProps {
  config: ReportCoreConfig;
  db: Firestore;
  children: ReactNode;
}

/**
 * Provides report-core configuration to all report hooks and components.
 *
 * Place this in your root layout (or admin layout) so both user-facing
 * ReportButton and admin components can access the config.
 *
 * @example
 * ```tsx
 * import { ReportCoreProvider } from "@ttt-productions/report-core";
 * import { reportConfig } from "@/lib/report-config";
 * import { getFirebaseDb } from "@/lib/firebase";
 *
 * <ReportCoreProvider config={reportConfig} db={getFirebaseDb()}>
 *   {children}
 * </ReportCoreProvider>
 * ```
 */
export function ReportCoreProvider({ config, db, children }: ReportCoreProviderProps) {
  const priorityThresholds = config.priorityThresholds ?? DEFAULT_PRIORITY_THRESHOLDS;

  return (
    <ReportCoreContext.Provider value={{ config, db, priorityThresholds }}>
      {children}
    </ReportCoreContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

/**
 * Access report-core context.
 * Throws if used outside of ReportCoreProvider.
 */
export function useReportCoreContext(): ReportCoreContextValue {
  const context = useContext(ReportCoreContext);
  if (!context) {
    throw new Error(
      'useReportCoreContext must be used within a ReportCoreProvider. ' +
      'Wrap your app or admin layout with <ReportCoreProvider config={...} db={...}>.'
    );
  }
  return context;
}
