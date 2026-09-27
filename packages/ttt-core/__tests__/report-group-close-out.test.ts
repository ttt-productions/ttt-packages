import { describe, it, expect } from 'vitest';
import { ReportGroupV1Schema } from '../src/doc-schemas/safety/report';

const resolvedGroup = {
  schemaVersion: 1,
  groupKey: 'square-streetz-post:p1:r1',
  itemType: 'square-streetz-post',
  totalReports: 2,
  highestReasonScore: 2,
  lastReportAt: 1,
  latestReason: 'Spam',
  status: 'resolved',
  resolutionOutcome: 'founded',
  resolvedBy: 'admin-1',
  resolvedAt: 5,
} as const;

describe('report group — ordinary root close-out marker', () => {
  it('records that the group still owes its report roots their terminal state', () => {
    expect(ReportGroupV1Schema.safeParse({ ...resolvedGroup, pendingRootTerminalization: true }).success).toBe(true);
    expect(ReportGroupV1Schema.safeParse({ ...resolvedGroup, pendingRootTerminalization: false }).success).toBe(true);
    expect(ReportGroupV1Schema.safeParse(resolvedGroup).success).toBe(true);
  });

  it('holds only a flag — the outcome it applies is the group\'s own resolution outcome', () => {
    expect(ReportGroupV1Schema.safeParse({ ...resolvedGroup, pendingRootTerminalization: 'founded' }).success).toBe(
      false,
    );
  });
});
