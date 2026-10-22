import { describe, it, expect } from 'vitest';
import {
  accountActionCommandDocId,
  adminDispatchReplyEventId,
  auditionEntryMediaOwnerId,
  commissionProposalMediaOwnerId,
  conversationFileMediaOwnerId,
  reportGroupOccurrenceEventId,
  adminTaskForItemDocId,
  childSafetyCaseAccountHistoryDocId,
  childSafetyDecisionDocId,
  childSafetyLifecycleDecisionDocId,
  childSafetyReportDispositionDecisionDocId,
  contentAppealAdminTaskDocId,
  followCounterDocId,
  followEdgeDocId,
  ncmecSubmissionJobDocId,
  nciiCaseClosureEventDocId,
  nciiDurableCaseId,
  notificationFanoutJobDocId,
  parseAccountActionCommandDocId,
  parseAdminTaskForItemDocId,
  parseAuditionEntryMediaOwnerId,
  parseNcmecSubmissionJobDocId,
  parseSafetyHoldRefDocId,
  parseSafetySlaMonitorDocId,
  parseThresholdItemDocId,
  safetyHoldRefDocId,
  safetySlaMonitorDocId,
  taggedCraftSkillDocId,
  thresholdItemDocId,
  thresholdSubmissionEventId,
} from '../src/paths/compound-ids.js';
import { PATH_BUILDERS } from '../src/paths/path-builders.js';
import { parseNotificationFanoutJobDocId } from '../src/paths/notification-fanout-job-ids.js';
import { buildUserReportAdminTaskDoc } from '@ttt-productions/report-core/server';
import type { ServerReportCoreConfig } from '@ttt-productions/report-core/server';
import { USER_REPORT_TASK_TYPE } from '@ttt-productions/report-core/contracts';

// Every expected id below is the format already persisted in Firestore: a builder that produced
// anything else would address a different document than the rows already written.

describe('follow ids', () => {
  it('a follow edge is keyed follower, target type, then target, joined by a double underscore', () => {
    expect(followEdgeDocId('userA', 'workProject', 'wp1')).toBe('userA__workProject__wp1');
  });

  it('a follower counter is keyed target type then target, joined by a double underscore', () => {
    expect(followCounterDocId('workRealm', 'realm1')).toBe('workRealm__realm1');
  });

  it('the follow path builders address the documents the id builders key', () => {
    expect(PATH_BUILDERS.followEdge('userA', 'user', 'userB')[1]).toBe(
      followEdgeDocId('userA', 'user', 'userB'),
    );
    expect(PATH_BUILDERS.followCounter('user', 'userB')[1]).toBe(
      followCounterDocId('user', 'userB'),
    );
  });
});

describe('craft skill tag ids', () => {
  it('a tagged craft skill is keyed craft skill then owner, joined by a dash', () => {
    expect(taggedCraftSkillDocId('skill1', 'uid1')).toBe('skill1-uid1');
  });

  it('the tagged craft skill path builder addresses the document the id builder keys', () => {
    expect(PATH_BUILDERS.taggedCraftSkill('drums', 'skill1', 'uid1')).toEqual([
      'craftSkillsByTag',
      'drums',
      'taggedCraftSkills',
      'skill1-uid1',
    ]);
  });
});

describe('threshold-library ids', () => {
  it('a threshold item is keyed Work then sub-item, joined by an underscore', () => {
    expect(thresholdItemDocId('wp1', 'item1')).toBe('wp1_item1');
  });

  it('a submission event is the threshold item and its submit time, joined by a colon', () => {
    expect(thresholdSubmissionEventId('wp1_item1', 1700000000000)).toBe('wp1_item1:1700000000000');
  });

  it('two submissions of one item at different times are different events', () => {
    const itemId = thresholdItemDocId('wp1', 'item1');
    expect(thresholdSubmissionEventId(itemId, 1)).not.toBe(thresholdSubmissionEventId(itemId, 2));
  });
});

describe('admin task ids', () => {
  it('an item task is keyed task type then item, joined by a dash', () => {
    expect(adminTaskForItemDocId('thresholdLibraryReview', 'wp1_item1')).toBe(
      'thresholdLibraryReview-wp1_item1',
    );
  });

  it('the item task path builder addresses the document the id builder keys', () => {
    expect(PATH_BUILDERS.adminTaskForItem('adminDispatch', 'd1')[1]).toBe(
      adminTaskForItemDocId('adminDispatch', 'd1'),
    );
  });

  it('an item task id parses back to its item id under its own task type', () => {
    const docId = adminTaskForItemDocId('userReport', 'groupKey1');
    expect(parseAdminTaskForItemDocId('userReport', docId)).toBe('groupKey1');
  });

  it('an item id that itself contains dashes parses back whole', () => {
    const docId = adminTaskForItemDocId('hallContentChangeRequest', 'a-b-c');
    expect(parseAdminTaskForItemDocId('hallContentChangeRequest', docId)).toBe('a-b-c');
  });

  it('an id of another task type, or with no item id, does not parse', () => {
    const docId = adminTaskForItemDocId('adminDispatch', 'd1');
    expect(parseAdminTaskForItemDocId('userReport', docId)).toBeNull();
    expect(parseAdminTaskForItemDocId('userReport', 'userReport-')).toBeNull();
    expect(parseAdminTaskForItemDocId('userReport', 'userReport')).toBeNull();
  });

  it("report-core's userReport task id is the item task id of its report group", () => {
    const config: ServerReportCoreConfig = {
      collections: {
        reports: 'reports',
        reportGroups: 'reportGroups',
        adminTasks: 'adminTasks',
      },
      taskQueues: {},
      priorityConfig: {
        reasonScores: {},
        itemTypeMultipliers: {},
        additionalReportBonus: 0,
        defaultReasonScore: 1,
        defaultItemTypeMultiplier: 1,
      },
    };
    const { adminTaskId } = buildUserReportAdminTaskDoc({
      config,
      groupData: { reportedItemType: 'square-streetz-post', totalReports: 1 },
      groupId: 'groupKey1',
      now: 1,
    });
    expect(adminTaskId).toBe(adminTaskForItemDocId(USER_REPORT_TASK_TYPE, 'groupKey1'));
    expect(parseAdminTaskForItemDocId(USER_REPORT_TASK_TYPE, adminTaskId)).toBe('groupKey1');
  });

  it('a content-appeal task is keyed by its violation behind the appeal prefix', () => {
    expect(contentAppealAdminTaskDocId('violation1')).toBe('appeal-violation1');
  });
});

describe('notification fanout job ids', () => {
  it('a fanout job is keyed event then notification type, joined by a colon', () => {
    expect(notificationFanoutJobDocId('event1', 'followed_content_published')).toBe(
      'event1:followed_content_published',
    );
  });
});

describe('safety hold ref ids', () => {
  it('a hold ref is keyed case then resource key hash, joined by a double underscore', () => {
    expect(safetyHoldRefDocId('case1', 'abc123')).toBe('case1__abc123');
  });

  it('a hold ref id parses back to the case and resource key hash it was built from', () => {
    expect(parseSafetyHoldRefDocId(safetyHoldRefDocId('case1', 'abc123'))).toEqual({
      caseId: 'case1',
      resourceKeyHash: 'abc123',
    });
  });

  it('an id that is not exactly two non-empty parts is refused', () => {
    expect(parseSafetyHoldRefDocId('case1')).toBeNull();
    expect(parseSafetyHoldRefDocId('case1__')).toBeNull();
    expect(parseSafetyHoldRefDocId('__abc123')).toBeNull();
    expect(parseSafetyHoldRefDocId('case1__abc123__extra')).toBeNull();
    expect(parseSafetyHoldRefDocId('')).toBeNull();
  });
});

describe('NCII durable case ids', () => {
  it("an NCII case's durable hold case id is the case id with the nciiDurable suffix", () => {
    expect(nciiDurableCaseId('case1')).toBe('case1::nciiDurable');
  });

  it('a durable hold ref is keyed under the durable case id', () => {
    expect(safetyHoldRefDocId(nciiDurableCaseId('case1'), 'serving-key')).toBe(
      'case1::nciiDurable__serving-key',
    );
  });
});

describe('account action command ids', () => {
  it('the automatic command is keyed case then account, joined by a double underscore', () => {
    expect(accountActionCommandDocId('case1', 'uid1', 'autoHash')).toBe('case1__uid1');
  });

  it("an operator's command carries the operator suffix so it never shares the automatic row", () => {
    expect(accountActionCommandDocId('case1', 'uid1', 'operator')).toBe('case1__uid1__operator');
    expect(accountActionCommandDocId('case1', 'uid1', 'operator')).not.toBe(
      accountActionCommandDocId('case1', 'uid1', 'autoHash'),
    );
  });

  it('each source parses back to the case, account, and source it was built from', () => {
    for (const source of ['autoHash', 'operator'] as const) {
      expect(
        parseAccountActionCommandDocId(accountActionCommandDocId('case1', 'uid1', source)),
      ).toEqual({ caseId: 'case1', targetUid: 'uid1', source });
    }
  });

  it('an id of neither form is refused', () => {
    expect(parseAccountActionCommandDocId('case1')).toBeNull();
    expect(parseAccountActionCommandDocId('case1__')).toBeNull();
    expect(parseAccountActionCommandDocId('__uid1')).toBeNull();
    expect(parseAccountActionCommandDocId('case1__uid1__autoHash')).toBeNull();
    expect(parseAccountActionCommandDocId('case1__uid1__operator__x')).toBeNull();
  });
});

describe('safety SLA monitor and NCMEC job ids', () => {
  it('a case-scoped monitor is keyed case then monitor kind, joined by a double underscore', () => {
    expect(safetySlaMonitorDocId('case1', 'evidenceStall')).toBe('case1__evidenceStall');
  });

  it('the removal-deadline monitor is keyed by its take-it-down request', () => {
    expect(safetySlaMonitorDocId('request1', 'nciiRemovalDeadline')).toBe(
      'request1__nciiRemovalDeadline',
    );
  });

  it('an NCMEC submission job is keyed case then submission, joined by a double underscore', () => {
    expect(ncmecSubmissionJobDocId('case1', 'sub1')).toBe('case1__sub1');
  });
});

describe('case lifecycle record ids', () => {
  it('an NCII closure event is keyed by its transition and the case revision', () => {
    expect(nciiCaseClosureEventDocId('closure', 3)).toBe('closure-r3');
    expect(nciiCaseClosureEventDocId('reopen', 3)).toBe('reopen-r3');
  });

  it('a child-safety lifecycle decision is keyed by its transition, case, and revision', () => {
    expect(childSafetyLifecycleDecisionDocId('closure', 'case1', 2)).toBe('closure-case1-r2');
    expect(childSafetyLifecycleDecisionDocId('reopen', 'case1', 2)).toBe('reopen-case1-r2');
  });

  it('a report-disposition decision is keyed by when it was made', () => {
    expect(childSafetyReportDispositionDecisionDocId(1700000000000)).toBe(
      '1700000000000_reportDisposition',
    );
  });

  it('an account history row is keyed by when the action was taken and its source', () => {
    expect(childSafetyCaseAccountHistoryDocId(1700000000000, 'autoHash')).toBe(
      '1700000000000_autoHash',
    );
    expect(childSafetyCaseAccountHistoryDocId(1700000000000, 'operator')).toBe('1700000000000_op');
  });

  it('a decision id is the lifecycle id under its own case, or the disposition id', () => {
    expect(
      childSafetyDecisionDocId('case1', { kind: 'lifecycle', transition: 'reopen', revision: 2 }),
    ).toBe('reopen-case1-r2');
    expect(childSafetyDecisionDocId('case1', { kind: 'reportDisposition', at: 5 })).toBe(
      '5_reportDisposition',
    );
  });

  it('the case lifecycle path builders address the documents the id builders key', () => {
    expect(PATH_BUILDERS.nciiCaseClosureEvent('case1', 'closure', 3)).toEqual([
      'nciiCases',
      'case1',
      'closureEvents',
      'closure-r3',
    ]);
    const decisions = ['childSafetyCases', 'case1', 'childSafetyDecisions'];
    expect(
      PATH_BUILDERS.childSafetyDecision('case1', {
        kind: 'lifecycle',
        transition: 'closure',
        revision: 3,
      }),
    ).toEqual([...decisions, 'closure-case1-r3']);
    expect(
      PATH_BUILDERS.childSafetyDecision('case1', { kind: 'reportDisposition', at: 1700000000000 }),
    ).toEqual([...decisions, '1700000000000_reportDisposition']);
    const history = [
      'childSafetyCases',
      'case1',
      'childSafetyCaseAccounts',
      'uid1',
      'childSafetyCaseAccountHistory',
    ];
    expect(PATH_BUILDERS.childSafetyCaseAccountHistory('case1', 'uid1', 7, 'operator')).toEqual([
      ...history,
      '7_op',
    ]);
    expect(PATH_BUILDERS.childSafetyCaseAccountHistory('case1', 'uid1', 7, 'autoHash')).toEqual([
      ...history,
      '7_autoHash',
    ]);
  });
});

describe('notification event ids', () => {
  it('an admin reply to a user-party thread is keyed by the thread and the message', () => {
    expect(adminDispatchReplyEventId('dispatch1', 'msg1')).toBe('dispatch1:msg1');
  });

  it('an admin reply to a Work-party thread is keyed per recipient as well', () => {
    expect(adminDispatchReplyEventId('dispatch1', 'msg1', 'uid1')).toBe('dispatch1:msg1:uid1');
    expect(adminDispatchReplyEventId('dispatch1', 'msg1', 'uid1')).not.toBe(
      adminDispatchReplyEventId('dispatch1', 'msg1', 'uid2'),
    );
  });

  it("a report group's climbing occurrence is keyed by the group and its report total", () => {
    expect(reportGroupOccurrenceEventId('group1', 3)).toBe('group1:3');
    expect(reportGroupOccurrenceEventId('group1', 3)).not.toBe(
      reportGroupOccurrenceEventId('group1', 4),
    );
  });
});

describe('media owner ids', () => {
  it('an audition entry is owned under its audition, then its entry id', () => {
    expect(auditionEntryMediaOwnerId('audition1', 'uid1')).toBe('audition1:uid1');
  });

  it('an audition entry owner id parses back to the audition and entry it was built from', () => {
    expect(parseAuditionEntryMediaOwnerId(auditionEntryMediaOwnerId('audition1', 'uid1'))).toEqual({
      auditionId: 'audition1',
      auditionEntryId: 'uid1',
    });
  });

  it('an audition entry owner id that is not exactly two non-empty parts is refused', () => {
    expect(parseAuditionEntryMediaOwnerId('audition1')).toBeNull();
    expect(parseAuditionEntryMediaOwnerId('audition1:')).toBeNull();
    expect(parseAuditionEntryMediaOwnerId(':uid1')).toBeNull();
    expect(parseAuditionEntryMediaOwnerId('audition1:uid1:extra')).toBeNull();
    expect(parseAuditionEntryMediaOwnerId('')).toBeNull();
  });

  it('a commission proposal is owned under its listing, then its proposal id', () => {
    expect(commissionProposalMediaOwnerId('listing1', 'uid1')).toBe('listing1:uid1');
  });

  it("a Conversation File is owned under its conversation's own id, then its file id", () => {
    expect(
      conversationFileMediaOwnerId({ kind: 'guildInvite', guildInviteId: 'invite1' }, 'file1'),
    ).toBe('invite1:file1');
    expect(
      conversationFileMediaOwnerId({ kind: 'adminSupport', adminDispatchId: 'dispatch1' }, 'file1'),
    ).toBe('dispatch1:file1');
  });
});

describe('ids read back from a stored or listed id', () => {
  it('a threshold item id parses back to its Work and sub-item', () => {
    expect(parseThresholdItemDocId(thresholdItemDocId('wp1', 'item1'))).toEqual({
      workProjectId: 'wp1',
      itemId: 'item1',
    });
  });

  it('a threshold item id that is not exactly two non-empty parts is refused', () => {
    expect(parseThresholdItemDocId('wp1')).toBeNull();
    expect(parseThresholdItemDocId('wp1_')).toBeNull();
    expect(parseThresholdItemDocId('_item1')).toBeNull();
    expect(parseThresholdItemDocId('wp1_item1_extra')).toBeNull();
    expect(parseThresholdItemDocId('')).toBeNull();
  });

  it('a monitor id parses back to its scope and kind', () => {
    expect(parseSafetySlaMonitorDocId(safetySlaMonitorDocId('case1', 'evidenceStall'))).toEqual({
      scopeId: 'case1',
      monitorKind: 'evidenceStall',
    });
    expect(
      parseSafetySlaMonitorDocId(safetySlaMonitorDocId('request1', 'nciiRemovalDeadline')),
    ).toEqual({ scopeId: 'request1', monitorKind: 'nciiRemovalDeadline' });
  });

  it('a monitor id without a scope or a known kind is refused', () => {
    expect(parseSafetySlaMonitorDocId('case1__notAKind')).toBeNull();
    expect(parseSafetySlaMonitorDocId('__evidenceStall')).toBeNull();
    expect(parseSafetySlaMonitorDocId('case1')).toBeNull();
    expect(parseSafetySlaMonitorDocId('case1__evidenceStall__x')).toBeNull();
  });

  it('an NCMEC job id parses back to its case and submission', () => {
    expect(parseNcmecSubmissionJobDocId(ncmecSubmissionJobDocId('case1', 'sub1'))).toEqual({
      caseId: 'case1',
      submissionId: 'sub1',
    });
  });

  it('an NCMEC job id that is not exactly two non-empty parts is refused', () => {
    expect(parseNcmecSubmissionJobDocId('case1')).toBeNull();
    expect(parseNcmecSubmissionJobDocId('case1__')).toBeNull();
    expect(parseNcmecSubmissionJobDocId('__sub1')).toBeNull();
    expect(parseNcmecSubmissionJobDocId('case1__sub1__x')).toBeNull();
  });

  it('a fanout job id parses back to its event and type, even when the event id holds colons', () => {
    const eventId = thresholdSubmissionEventId('wp1_item1', 1700000000000);
    expect(
      parseNotificationFanoutJobDocId(
        notificationFanoutJobDocId(eventId, 'followed_content_published'),
      ),
    ).toEqual({
      eventId: 'wp1_item1:1700000000000',
      notificationType: 'followed_content_published',
    });
  });

  it('a fanout job id without an event id or a known notification type is refused', () => {
    expect(parseNotificationFanoutJobDocId('event1:not_a_type')).toBeNull();
    expect(parseNotificationFanoutJobDocId(':followed_content_published')).toBeNull();
    expect(parseNotificationFanoutJobDocId('event1')).toBeNull();
    expect(parseNotificationFanoutJobDocId('')).toBeNull();
  });
});

describe('the id-keyed path builders address the documents their id builders key', () => {
  it('each takes the parts and yields the path already persisted', () => {
    expect(PATH_BUILDERS.thresholdItem('wp1', 'item1')).toEqual(['thresholdItems', 'wp1_item1']);
    expect(PATH_BUILDERS.safetyHoldRef('case1', 'abc123')).toEqual([
      'safetyHoldRefs',
      'case1__abc123',
    ]);
    expect(PATH_BUILDERS.accountActionCommand('case1', 'uid1', 'autoHash')).toEqual([
      'accountActionCommands',
      'case1__uid1',
    ]);
    expect(PATH_BUILDERS.accountActionCommand('case1', 'uid1', 'operator')).toEqual([
      'accountActionCommands',
      'case1__uid1__operator',
    ]);
    expect(PATH_BUILDERS.safetySlaMonitor('request1', 'nciiRemovalDeadline')).toEqual([
      'safetySlaMonitors',
      'request1__nciiRemovalDeadline',
    ]);
    expect(PATH_BUILDERS.ncmecSubmissionJob('case1', 'sub1')).toEqual([
      'ncmecSubmissionJobs',
      'case1__sub1',
    ]);
    expect(PATH_BUILDERS.notificationFanoutJob('event-hash', 'admin_announcement')).toEqual([
      'notificationFanoutJobs',
      'event-hash:admin_announcement',
    ]);
  });
});
