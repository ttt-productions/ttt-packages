'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ReportCoreConfig, PriorityThreshold } from '../../contracts/config.js';
import { DEFAULT_PRIORITY_THRESHOLDS } from '../../contracts/config.js';
import type { AdditionalReportAction } from '../types-ui-props.js';
import type { SubmitReportRequest, SubmitReportResult } from '../../schemas/requests.js';

/** The app's call to its report-intake callable, typed and bound once by the app. */
export type SubmitReportFn = (request: SubmitReportRequest) => Promise<SubmitReportResult>;

export interface ReportCoreContextValue {
  config: ReportCoreConfig;
  submitReportFn: SubmitReportFn;
  /** Resolved priority thresholds (from config or defaults) */
  priorityThresholds: PriorityThreshold[];
  /** Consumer-supplied extra picker actions (see `AdditionalReportAction`). Default: none. */
  additionalReportActions: AdditionalReportAction[];
}

const ReportCoreContext = createContext<ReportCoreContextValue | null>(null);

export interface ReportCoreProviderProps {
  config: ReportCoreConfig;
  submitReportFn: SubmitReportFn;
  children: ReactNode;
  /** Consumer-supplied extra picker actions (already filtered for visibility, e.g. admin-only). */
  additionalReportActions?: AdditionalReportAction[];
}

/**
 * Provides report-core configuration to all report hooks and components.
 *
 * Place this in your root layout (or admin layout) so both user-facing
 * ReportButton and admin components can access the config.
 *
 * report-core's data hooks read Firestore through query-core's hooks, so this
 * provider must sit **inside** query-core's `<FirestoreProvider db={...}>` (the
 * single Firestore source).
 *
 * @example
 * ```tsx
 * import { FirestoreProvider } from "@ttt-productions/query-core/react";
 * import { ReportCoreProvider } from "@ttt-productions/report-core/react";
 * import { reportConfig } from "@/lib/report-config";
 * import { getFirebaseDb } from "@/lib/firebase";
 * import { submitReport } from "@/lib/callables";
 *
 * <FirestoreProvider db={getFirebaseDb()}>
 *   <ReportCoreProvider config={reportConfig} submitReportFn={submitReport}>
 *     {children}
 *   </ReportCoreProvider>
 * </FirestoreProvider>
 * ```
 */
export function ReportCoreProvider({ config, submitReportFn, children, additionalReportActions = [] }: ReportCoreProviderProps) {
  const priorityThresholds = config.priorityThresholds ?? DEFAULT_PRIORITY_THRESHOLDS;

  return (
    <ReportCoreContext.Provider value={{ config, submitReportFn, priorityThresholds, additionalReportActions }}>
      {children}
    </ReportCoreContext.Provider>
  );
}

export function useReportCoreContext(): ReportCoreContextValue {
  const context = useContext(ReportCoreContext);
  if (!context) {
    throw new Error(
      'useReportCoreContext must be used within a ReportCoreProvider. ' +
      'Wrap your app or admin layout with <ReportCoreProvider config={...} submitReportFn={...}>.'
    );
  }
  return context;
}
