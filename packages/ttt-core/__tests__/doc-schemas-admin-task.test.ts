// Contract tests for the STORED userReport `adminTasks/{taskId}` doc shape — the three
// lifecycle shapes the report pipeline writes (fresh create, in-place reopen, recreate after
// a guided close-out). These pin the cross-boundary contract: Functions (report-core's task
// creator + the app's report-group trigger) writes these docs and the admin queue UI reads
// them, so a shape the schema strips or rejects is drift, not an "app-side" detail.

import { describe, it, expect } from 'vitest';
import {
  AdminTaskDocSchema,
  AdminTaskClosureHistoryEntrySchema,
} from '../src/doc-schemas/report-docs';

/** A fresh userReport task exactly as report-core's buildUserReportAdminTaskDoc writes it. */
const freshUserReportTask = () => ({
  taskType: 'userReport',
  taskId: 'group-1',
  originalPath: 'activeReportGroups/group-1',
  status: 'pending',
  checkoutDetails: null,
  summary: '1 report for squarePost',
  priority: 10,
  reportedUserId: 'owner-1',
  reportedItemType: 'squarePost',
  reportedItemId: 'post-1',
  parentItemId: null,
  createdAt: 1_700_000_000_000,
  lastUpdatedAt: 1_700_000_000_000,
});

describe('AdminTaskDocSchema — userReport lifecycle shapes', () => {
  it('parses a freshly created userReport task, preserving every report-identity field', () => {
    const parsed = AdminTaskDocSchema.parse(freshUserReportTask());
    expect(parsed.reportedUserId).toBe('owner-1');
    expect(parsed.reportedItemType).toBe('squarePost');
    expect(parsed.reportedItemId).toBe('post-1');
    expect(parsed.parentItemId).toBeNull();
    expect(parsed.closureHistory).toBeUndefined();
  });

  it('parses an unresolved-owner task (all four identity fields null — e.g. a chat report)', () => {
    const parsed = AdminTaskDocSchema.parse({
      ...freshUserReportTask(),
      reportedUserId: null,
      reportedItemType: null,
      reportedItemId: null,
      parentItemId: null,
    });
    expect(parsed.reportedUserId).toBeNull();
  });

  it('parses an IN-PLACE reopened task: completedAt DELETED (absent), closureHistory appended', () => {
    const parsed = AdminTaskDocSchema.parse({
      ...freshUserReportTask(),
      summary: '2 reports for squarePost',
      priority: 12,
      // Reopen resets to the pending pool; completedAt is FieldValue.delete()d, never null.
      closureHistory: [{ completedAt: 1_700_000_100_000, reopenedAt: 1_700_000_200_000 }],
    });
    expect(parsed.completedAt).toBeUndefined();
    expect(parsed.closureHistory).toEqual([
      { completedAt: 1_700_000_100_000, reopenedAt: 1_700_000_200_000 },
    ]);
  });

  it('parses a RECREATED-after-close task: fresh doc seeded with the prior closure from the group resolvedAt', () => {
    const parsed = AdminTaskDocSchema.parse({
      ...freshUserReportTask(),
      closureHistory: [{ completedAt: 1_700_000_100_000, reopenedAt: 1_700_000_300_000 }],
    });
    expect(parsed.status).toBe('pending');
    expect(parsed.checkoutDetails).toBeNull();
    expect(parsed.closureHistory).toHaveLength(1);
  });

  it('a closure entry tolerates a null completedAt (neither survivor recorded the instant)', () => {
    expect(
      AdminTaskClosureHistoryEntrySchema.parse({ completedAt: null, reopenedAt: 5 }),
    ).toEqual({ completedAt: null, reopenedAt: 5 });
  });

  it('REJECTS completedAt: null on the task doc — "not completed" has exactly one representation (absent)', () => {
    const result = AdminTaskDocSchema.safeParse({
      ...freshUserReportTask(),
      completedAt: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed closureHistory entry', () => {
    const result = AdminTaskDocSchema.safeParse({
      ...freshUserReportTask(),
      closureHistory: [{ reopenedAt: 'yesterday' }],
    });
    expect(result.success).toBe(false);
  });
});
