'use client';

import { useMutation } from '@tanstack/react-query';
import { useReportCoreContext } from '../context/ReportCoreProvider.js';
import type { SubmitReportRequest, SubmitReportResult } from '../schemas/index.js';

/** UI input the dialog collects. Mapped to the callable's strict request shape. */
interface SubmitReportInput {
  itemType: string;
  itemId: string;
  parentItemId?: string;
  /** HINT ONLY — the server re-derives the owner; never trusted as authority. */
  reportedUserId?: string;
  reason: string;
  comment: string;
  /** Confirmed upgrade of an existing report to a protected reason (the 2nd call after the
   *  `upgradeAvailable` outcome). Only meaningful with a protected reason. */
  confirmUpgrade?: boolean;
}

/** Default callable name; the consuming app may override via `config.submitCallableName`. */
const DEFAULT_SUBMIT_CALLABLE_NAME = 'submitReport';

/**
 * Mutation hook to submit a report via the Trust & Safety `submitReport` callable.
 *
 * The callable name is configurable (`config.submitCallableName ?? 'submitReport'`).
 * It maps the UI input onto the strict request shape and returns the callable's
 * `SubmitReportResult` verbatim (discriminated on `outcome`).
 *
 * One report per reporter per target: a duplicate ordinary submit returns
 * `outcome: 'alreadyReported'` (honest deny), and a protected (Child Safety / NCII) reason on an
 * already-reported item returns `outcome: 'upgradeAvailable'` — the UI prompts to upgrade, then
 * re-calls with `confirmUpgrade: true` (→ `outcome: 'upgraded'`). The consumer branches on `outcome`.
 */
export function useReportSubmit() {
  const { callFunction, config } = useReportCoreContext();
  const callableName = config.submitCallableName ?? DEFAULT_SUBMIT_CALLABLE_NAME;

  return useMutation({
    mutationFn: async (input: SubmitReportInput): Promise<SubmitReportResult> => {
      const request: SubmitReportRequest = {
        itemType: input.itemType,
        reportedItemId: input.itemId,
        ...(input.parentItemId ? { parentItemId: input.parentItemId } : {}),
        ...(input.reportedUserId ? { reportedUserId: input.reportedUserId } : {}),
        reason: input.reason,
        ...(input.comment ? { comment: input.comment } : {}),
        ...(input.confirmUpgrade ? { confirmUpgrade: true } : {}),
      };

      return callFunction<SubmitReportRequest, SubmitReportResult>(callableName, request);
    },
  });
}
