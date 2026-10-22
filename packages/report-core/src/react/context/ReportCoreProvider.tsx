'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ReportCoreConfig, PriorityThreshold } from '../../contracts/config.js';
import { DEFAULT_PRIORITY_THRESHOLDS } from '../../contracts/config.js';
import type { AdditionalReportAction } from '../types-ui-props.js';
import type { SubmitReportRequest, SubmitReportResult } from '../../schemas/requests.js';

export type SubmitReportFn = (request: SubmitReportRequest) => Promise<SubmitReportResult>;

export interface ReportCoreContextValue {
  config: ReportCoreConfig;
  submitReportFn: SubmitReportFn;
  priorityThresholds: PriorityThreshold[];
  additionalReportActions: AdditionalReportAction[];
}

const ReportCoreContext = createContext<ReportCoreContextValue | null>(null);

export interface ReportCoreProviderProps {
  config: ReportCoreConfig;
  submitReportFn: SubmitReportFn;
  children: ReactNode;
  additionalReportActions?: AdditionalReportAction[];
}

export function ReportCoreProvider({
  config,
  submitReportFn,
  children,
  additionalReportActions = [],
}: ReportCoreProviderProps) {
  const priorityThresholds = config.priorityThresholds ?? DEFAULT_PRIORITY_THRESHOLDS;

  return (
    <ReportCoreContext.Provider
      value={{ config, submitReportFn, priorityThresholds, additionalReportActions }}
    >
      {children}
    </ReportCoreContext.Provider>
  );
}

export function useReportCoreContext(): ReportCoreContextValue {
  const context = useContext(ReportCoreContext);
  if (!context) {
    throw new Error(
      'useReportCoreContext must be used within a ReportCoreProvider. ' +
        'Wrap your app or admin layout with <ReportCoreProvider config={...} submitReportFn={...}>.',
    );
  }
  return context;
}
