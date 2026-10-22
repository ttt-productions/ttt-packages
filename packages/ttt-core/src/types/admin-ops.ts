import type { PledgePaymentTotals } from './payments.js';
import type { FlatDeadLetterCollection } from '../schemas/admin.js';

export interface OpsSafetyClocks {
  armedMonitors: number;
  overdueMonitors: number;
  activeChildSafetyCases: number;
  activeNciiCases: number;
  activeTakeItDownRequests: number;
  earliestPhotoDnaContractAt?: number;
  earliestNciiRemovalDeadlineAt?: number;
}

export interface OpsBrokenMachinery {
  deadLetterTotal: number;
  deadLetteredFanoutJobs: number;
  stuckEdgeSyncCount: number;
  failedMediaCount: number;
  safetyMonitorHeartbeatLastRunAt?: number;
  safetyMonitorHeartbeatStale?: boolean;
}

export interface OpsStatus {
  generatedAt: number;
  media: { pending: number; processing: number; failed: number };
  adminQueue: {
    libraryReviews: number;
    changeRequests: number;
    reports: number;
    appeals: number;
    dispatches: number;
    opsAnomalies: number;
    refundRequests: number;
    disputes: number;
  };
  signupsLast24h: number;
  actionFailuresLast24h: number;
  paymentFailuresLast24h: number;
  pledge: PledgePaymentTotals;
  safetyClocks?: OpsSafetyClocks;
  brokenMachinery?: OpsBrokenMachinery;
}

export interface DeadLetterRow {
  collection: FlatDeadLetterCollection;
  docId: string;
  deadLetteredAt: number | null;
  lastError: string | null;
  attemptCount: number | null;
}

export interface GetDeadLettersResult {
  generatedAt: number;
  rows: DeadLetterRow[];
  truncated: boolean;
}
