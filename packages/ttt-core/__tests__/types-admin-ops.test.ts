import { describe, it, expectTypeOf } from 'vitest';
import type { OpsStatus, OpsSafetyClocks, OpsBrokenMachinery } from '../src/types/admin-ops';

describe('OpsStatus additive extension (Mission Control landing)', () => {
  const basePledge = { netRaised: 0, grossRaised: 0, totalRefunded: 0, pledgeCount: 0 };

  it('an older-shaped snapshot (no new blocks/fields) still satisfies OpsStatus', () => {
    const legacy: OpsStatus = {
      generatedAt: 1,
      media: { pending: 0, processing: 0, failed: 0 },
      adminQueue: { libraryReviews: 0, reports: 0, appeals: 0, dispatches: 0, opsAnomalies: 0 },
      signupsLast24h: 0,
      actionFailuresLast24h: 0,
      paymentFailuresLast24h: 0,
      pledge: basePledge,
    };
    expectTypeOf(legacy).toMatchTypeOf<OpsStatus>();
  });

  it('the new blocks + queue counts are all optional', () => {
    expectTypeOf<OpsStatus['safetyClocks']>().toEqualTypeOf<OpsSafetyClocks | undefined>();
    expectTypeOf<OpsStatus['brokenMachinery']>().toEqualTypeOf<OpsBrokenMachinery | undefined>();
    expectTypeOf<OpsStatus['adminQueue']['refundRequests']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<OpsStatus['adminQueue']['disputes']>().toEqualTypeOf<number | undefined>();
  });

  it('safety-clocks counts are numbers; per-lane earliest-deadline epochs are optional numbers', () => {
    const clocks: OpsSafetyClocks = {
      armedMonitors: 2,
      overdueMonitors: 1,
      activeChildSafetyCases: 0,
      activeNciiCases: 1,
      activeTakeItDownRequests: 3,
    };
    expectTypeOf(clocks).toMatchTypeOf<OpsSafetyClocks>();
    expectTypeOf<OpsSafetyClocks['earliestReviewDueAt']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<OpsSafetyClocks['earliestPhotoDnaContractAt']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<OpsSafetyClocks['earliestNciiRemovalDeadlineAt']>().toEqualTypeOf<number | undefined>();
  });

  it('broken-machinery counts are numbers; the heartbeat freshness epoch is an optional number', () => {
    const machinery: OpsBrokenMachinery = {
      deadLetterTotal: 0,
      deadLetteredFanoutJobs: 0,
      stuckEdgeSyncCount: 0,
      failedMediaCount: 0,
    };
    expectTypeOf(machinery).toMatchTypeOf<OpsBrokenMachinery>();
    expectTypeOf<OpsBrokenMachinery['safetyMonitorHeartbeatLastRunAt']>().toEqualTypeOf<number | undefined>();
  });
});
