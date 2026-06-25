'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ReportCoreConfig, PriorityThreshold } from '../config.js';
import { DEFAULT_PRIORITY_THRESHOLDS } from '../config.js';

// ============================================
// CONTEXT
// ============================================

/** The report target the dialog is acting on (passed to an additional action's handler). */
export interface ReportTargetRef {
  itemType: string;
  itemId: string;
  parentItemId?: string;
  reportedUserId?: string;
}

/**
 * A consumer-supplied EXTRA option in the report-reason picker — generic; report-core knows nothing
 * about what it does. The consumer (e.g. the TTT app) supplies these, already filtered for who may
 * see them (an admin-only action is supplied only when the current user is an admin). When the user
 * selects one and submits, the dialog calls `handler(target, comment)` INSTEAD of the report-intake
 * callable. Example use: an admin "mark as NCII linked evidence" option that calls a different callable.
 */
export interface AdditionalReportAction {
  /** Stable id (used as the picker value, prefixed internally). */
  id: string;
  /** Picker label shown in the reason dropdown. */
  label: string;
  /** Called instead of the report-intake submit when this option is selected. */
  handler: (target: ReportTargetRef, comment: string) => Promise<void>;
}

export interface ReportCoreContextValue {
  config: ReportCoreConfig;
  callFunction: <TReq, TRes>(name: string, data?: TReq) => Promise<TRes>;
  /** Resolved priority thresholds (from config or defaults) */
  priorityThresholds: PriorityThreshold[];
  /** Consumer-supplied extra picker actions (see `AdditionalReportAction`). Default: none. */
  additionalReportActions: AdditionalReportAction[];
}

const ReportCoreContext = createContext<ReportCoreContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

export interface ReportCoreProviderProps {
  config: ReportCoreConfig;
  callFunction: <TReq, TRes>(name: string, data?: TReq) => Promise<TRes>;
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
export function ReportCoreProvider({ config, callFunction, children, additionalReportActions = [] }: ReportCoreProviderProps) {
  const priorityThresholds = config.priorityThresholds ?? DEFAULT_PRIORITY_THRESHOLDS;

  return (
    <ReportCoreContext.Provider value={{ config, callFunction, priorityThresholds, additionalReportActions }}>
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
