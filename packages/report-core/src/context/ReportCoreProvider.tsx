'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ReportCoreConfig, PriorityThreshold } from '../config.js';
import { DEFAULT_PRIORITY_THRESHOLDS } from '../config.js';

// ============================================
// CONTEXT
// ============================================

export interface ReportCoreContextValue {
  config: ReportCoreConfig;
  callFunction: <TReq, TRes>(name: string, data?: TReq) => Promise<TRes>;
  /** Resolved priority thresholds (from config or defaults) */
  priorityThresholds: PriorityThreshold[];
}

const ReportCoreContext = createContext<ReportCoreContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

export interface ReportCoreProviderProps {
  config: ReportCoreConfig;
  callFunction: <TReq, TRes>(name: string, data?: TReq) => Promise<TRes>;
  children: ReactNode;
}

/**
 * Provides report-core configuration to all report hooks and components.
 *
 * Place this in your root layout (or admin layout) so both user-facing
 * ReportButton and admin components can access the config.
 *
 * report-core's data hooks read Firestore through query-core's hooks, so this
 * provider must sit **inside** query-core's `<FirestoreProvider db={...}>` (the
 * single Firestore source). report-core no longer takes its own `db`.
 *
 * @example
 * ```tsx
 * import { FirestoreProvider } from "@ttt-productions/query-core/react";
 * import { ReportCoreProvider } from "@ttt-productions/report-core/react";
 * import { reportConfig } from "@/lib/report-config";
 * import { getFirebaseDb } from "@/lib/firebase";
 * import { callFunction } from "@/lib/firebase-functions";
 *
 * <FirestoreProvider db={getFirebaseDb()}>
 *   <ReportCoreProvider config={reportConfig} callFunction={callFunction}>
 *     {children}
 *   </ReportCoreProvider>
 * </FirestoreProvider>
 * ```
 */
export function ReportCoreProvider({ config, callFunction, children }: ReportCoreProviderProps) {
  const priorityThresholds = config.priorityThresholds ?? DEFAULT_PRIORITY_THRESHOLDS;

  return (
    <ReportCoreContext.Provider value={{ config, callFunction, priorityThresholds }}>
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
      'Wrap your app or admin layout with <ReportCoreProvider config={...} callFunction={...}>.'
    );
  }
  return context;
}
