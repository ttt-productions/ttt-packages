import { describe, it, expectTypeOf } from 'vitest';
import type { OpsStatus, OpsSafetyClocks, OpsBrokenMachinery } from '../src/types/admin-ops';

describe('OpsStatus snapshot shape (Mission Control landing)', () => {
  const basePledge = { netRaised: 0, grossRaised: 0, totalRefunded: 0, pledgeCount: 0 };
  const adminQueue = {
    libraryReviews: 0,
    changeRequests: 0,
    reports: 0,
    appeals: 0,
    dispatches: 0,
    opsAnomalies: 0,
    refundRequests: 0,
    disputes: 0,
  };

  it('a snapshot without the optional safety and machinery blocks satisfies OpsStatus', () => {
    const snapshot: OpsStatus = {
      generatedAt: 1,
      media: { pending: 0, processing: 0, failed: 0 },
      adminQueue,
      signupsLast24h: 0,
      actionFailuresLast24h: 0,
      paymentFailuresLast24h: 0,
      pledge: basePledge,
    };
    expectTypeOf(snapshot).toMatchTypeOf<OpsStatus>();
  });

  it('every admin-queue lane, the change-request lane included, is a required count', () => {
    expectTypeOf<OpsStatus['adminQueue']>().toEqualTypeOf<{
      libraryReviews: number;
      changeRequests: number;
      reports: number;
      appeals: number;
      dispatches: number;
      opsAnomalies: number;
      refundRequests: number;
      disputes: number;
    }>();
    // @ts-expect-error — a snapshot without the change-request lane is not a complete queue count.
    const withoutChangeRequests: OpsStatus['adminQueue'] = { ...adminQueue, changeRequests: undefined };
    void withoutChangeRequests;
  });

  it('the safety and machinery blocks are optional', () => {
    expectTypeOf<OpsStatus['safetyClocks']>().toEqualTypeOf<OpsSafetyClocks | undefined>();
    expectTypeOf<OpsStatus['brokenMachinery']>().toEqualTypeOf<OpsBrokenMachinery | undefined>();
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
    // Staleness is SERVER-derived (ARCH-102) — the client must never re-declare the threshold.
    expectTypeOf<OpsBrokenMachinery['safetyMonitorHeartbeatStale']>().toEqualTypeOf<boolean | undefined>();
  });
});
