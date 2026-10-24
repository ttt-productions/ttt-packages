import { describe, it, expect } from 'vitest';
import { TASK_PRIORITY_SCORE } from '../src/constants/business-admin.js';
import { ContentAppealTaskSchema } from '../src/doc-schemas/moderation.js';
import { AdminTaskDocSchema } from '../src/doc-schemas/report-docs.js';
import { contentAppealAdminTaskDocId } from '../src/paths/compound-ids.js';
import { PATH_BUILDERS } from '../src/paths/path-builders.js';
import { toPath } from '../src/paths/utils.js';
import {
  buildAdminDispatchTask,
  buildContentAppealTask,
  buildThresholdLibraryReviewTask,
  calculateTaskPriority,
} from '../src/utils/admin-tasks.js';

describe('calculateTaskPriority', () => {
  it('ranks a user report HIGH, and CRITICAL past ten reports or for an illegal, csam, or child reason', () => {
    expect(
      calculateTaskPriority('userReport', { totalReports: 10, lastReportReason: 'spam' }),
    ).toBe(TASK_PRIORITY_SCORE.HIGH);
    expect(calculateTaskPriority('userReport', { totalReports: 11 })).toBe(
      TASK_PRIORITY_SCORE.CRITICAL,
    );
    for (const lastReportReason of ['Illegal activity', 'CSAM content', 'child safety issue'])
      expect(calculateTaskPriority('userReport', { totalReports: 1, lastReportReason })).toBe(
        TASK_PRIORITY_SCORE.CRITICAL,
      );
  });

  it('ranks a content appeal NORMAL, HIGH for a profile picture, and CRITICAL for a csam, child, or illegal reason', () => {
    expect(
      calculateTaskPriority('content-appeal', { reason: 'spam', fileType: 'skill-media' }),
    ).toBe(TASK_PRIORITY_SCORE.NORMAL);
    expect(
      calculateTaskPriority('content-appeal', { reason: 'spam', fileType: 'profile-picture' }),
    ).toBe(TASK_PRIORITY_SCORE.HIGH);
    for (const reason of ['CSAM report', 'child safety concern', 'illegal content detected'])
      expect(calculateTaskPriority('content-appeal', { reason, fileType: 'profile-picture' })).toBe(
        TASK_PRIORITY_SCORE.CRITICAL,
      );
  });

  it('ranks a threshold review NORMAL and HIGH for the news and political wing', () => {
    expect(calculateTaskPriority('thresholdLibraryReview', { hallWingType: 'entertainment' })).toBe(
      TASK_PRIORITY_SCORE.NORMAL,
    );
    expect(calculateTaskPriority('thresholdLibraryReview', { hallWingType: 'newsPolitical' })).toBe(
      TASK_PRIORITY_SCORE.HIGH,
    );
  });

  it('ranks a hall content change request NORMAL', () => {
    expect(calculateTaskPriority('hallContentChangeRequest', {})).toBe(TASK_PRIORITY_SCORE.NORMAL);
  });

  it('ranks an admin dispatch NORMAL and HIGH when its category or priority is urgent', () => {
    expect(calculateTaskPriority('adminDispatch', { category: 'general' })).toBe(
      TASK_PRIORITY_SCORE.NORMAL,
    );
    expect(calculateTaskPriority('adminDispatch', { category: 'urgent' })).toBe(
      TASK_PRIORITY_SCORE.HIGH,
    );
    expect(calculateTaskPriority('adminDispatch', { priority: 'urgent' })).toBe(
      TASK_PRIORITY_SCORE.HIGH,
    );
  });
});

describe('buildContentAppealTask', () => {
  const input = {
    violationId: 'violation-1',
    userId: 'member-1',
    fileType: 'profile-picture',
    rejectionReason: 'Adult content',
    appealMessage: 'This is a painting',
    rejectedFilePath: 'rejected/member-1/file.jpg',
    now: 42,
  };

  it('builds a pending, unlocked appeal task at its violation-keyed id that the task schema accepts', () => {
    const taskId = contentAppealAdminTaskDocId('violation-1');
    const task = buildContentAppealTask(input);
    expect(task).toEqual({
      id: taskId,
      taskType: 'content-appeal',
      taskId,
      violationId: 'violation-1',
      userId: 'member-1',
      fileType: 'profile-picture',
      rejectionReason: 'Adult content',
      appealMessage: 'This is a painting',
      rejectedFilePath: 'rejected/member-1/file.jpg',
      status: 'pending',
      checkoutDetails: null,
      originalPath: toPath(PATH_BUILDERS.contentViolation('violation-1')),
      summary: 'Appeal: profile-picture — Adult content',
      priority: TASK_PRIORITY_SCORE.HIGH,
      createdAt: 42,
      lastUpdatedAt: 42,
    });
    expect(ContentAppealTaskSchema.safeParse(task).success).toBe(true);
  });

  it('cuts the rejection reason to 80 characters in the summary', () => {
    const task = buildContentAppealTask({ ...input, rejectionReason: 'r'.repeat(120) });
    expect(task.summary).toBe(`Appeal: profile-picture — ${'r'.repeat(80)}`);
  });
});

describe('buildThresholdLibraryReviewTask', () => {
  it('builds a pending task pointing at its threshold item, ranked by the wing', () => {
    const task = buildThresholdLibraryReviewTask({
      thresholdItem: {
        thresholdItemId: 'wp-1__tale-1',
        workProjectId: 'wp-1',
        itemId: 'tale-1',
        hallWingType: 'newsPolitical',
      },
      workProjectType: 'Tales',
      foundingArtisanUid: 'founder-1',
      now: 7,
    });
    expect(task).toEqual({
      taskType: 'thresholdLibraryReview',
      taskId: 'wp-1__tale-1',
      foundingArtisanUid: 'founder-1',
      originalPath: toPath(PATH_BUILDERS.thresholdItem('wp-1', 'tale-1')),
      status: 'pending',
      checkoutDetails: null,
      summary: 'Review Tales',
      priority: TASK_PRIORITY_SCORE.HIGH,
      createdAt: 7,
      lastUpdatedAt: 7,
    });
    expect(AdminTaskDocSchema.safeParse(task).success).toBe(true);
  });
});

describe('buildAdminDispatchTask', () => {
  it('builds a pending, unlocked task pointing at its thread, with the party denormalized for a Work thread', () => {
    const task = buildAdminDispatchTask({
      dispatch: {
        adminDispatchId: 'thread-1',
        subject: 'About the Work',
        partyKind: 'workProject',
        workProjectId: 'wp-1',
      },
      fromUid: 'member-12345678',
      now: 42,
    });
    expect(task).toEqual({
      taskType: 'adminDispatch',
      taskId: 'thread-1',
      originalPath: toPath(PATH_BUILDERS.adminDispatch('thread-1')),
      status: 'pending',
      checkoutDetails: null,
      summary: 'Work thread: About the Work - from member-1',
      priority: TASK_PRIORITY_SCORE.NORMAL,
      createdAt: 42,
      lastUpdatedAt: 42,
      partyKind: 'workProject',
      workProjectId: 'wp-1',
    });
    expect(AdminTaskDocSchema.safeParse(task).success).toBe(true);
  });

  it('names no member in its summary when none is known, and carries no party for a user thread', () => {
    const task = buildAdminDispatchTask({
      dispatch: { adminDispatchId: 'thread-1', subject: 'Notice', partyKind: 'user' },
      now: 1,
    });
    expect(task.summary).toBe('Notice');
    expect(task).not.toHaveProperty('partyKind');
    expect(task).not.toHaveProperty('workProjectId');
  });

  it('writes no id field', () => {
    const task = buildAdminDispatchTask({
      dispatch: { adminDispatchId: 'thread-1', subject: 'Notice', partyKind: 'user' },
      now: 1,
    });
    expect(task).not.toHaveProperty('id');
  });
});
