import { describe, it, expect } from 'vitest';
import {
  TargetLocatorV1Schema,
  TargetLocatorKindSchema,
} from '../src/doc-schemas/safety/foundation.js';
import {
  ChildSafetyCaseListV1Schema,
  ChildSafetyCaseV1Schema,
} from '../src/doc-schemas/safety/case.js';
import { NciiCaseV1Schema } from '../src/doc-schemas/ncii/cases.js';
import { SafetySlaMonitorKindSchema } from '../src/doc-schemas/safety/monitors.js';

describe('TargetLocatorV1 — guildChatMessage', () => {
  it('accepts a valid guildChatMessage locator', () => {
    const result = TargetLocatorV1Schema.safeParse({
      kind: 'guildChatMessage',
      channelId: 'wp-1/chan-abc',
      messageId: 'msg-123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects guildChatMessage without channelId', () => {
    const result = TargetLocatorV1Schema.safeParse({
      kind: 'guildChatMessage',
      messageId: 'msg-123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects guildChatMessage without messageId', () => {
    const result = TargetLocatorV1Schema.safeParse({
      kind: 'guildChatMessage',
      channelId: 'wp-1/chan-abc',
    });
    expect(result.success).toBe(false);
  });

  it('rejects guildChatMessage with extra fields (.strict())', () => {
    const result = TargetLocatorV1Schema.safeParse({
      kind: 'guildChatMessage',
      channelId: 'wp-1/chan-abc',
      messageId: 'msg-123',
      attachmentId: 'should-not-be-here',
    });
    expect(result.success).toBe(false);
  });

  it('TargetLocatorKindSchema includes guildChatMessage', () => {
    const result = TargetLocatorKindSchema.safeParse('guildChatMessage');
    expect(result.success).toBe(true);
  });

  it('a chatAttachment locator does not parse (chat carries no media)', () => {
    const result = TargetLocatorV1Schema.safeParse({
      kind: 'chatAttachment',
      channelId: 'wp-1/chan-abc',
      messageId: 'msg-123',
      attachmentId: 'att-456',
    });
    expect(result.success).toBe(false);
    expect(TargetLocatorKindSchema.safeParse('chatAttachment').success).toBe(false);
  });

  it('a guildInviteMessage locator parses', () => {
    const result = TargetLocatorV1Schema.safeParse({
      kind: 'guildInviteMessage',
      channelId: 'invite-chan',
      messageId: 'msg-7',
    });
    expect(result.success).toBe(true);
  });
});

const BASE_CASE_LIST_DOC = {
  schemaVersion: 1 as const,
  caseId: 'case-1',
  revision: 0,
  canonicalIncidentKey: 'ik-1',
  incidentClass: 'apparentCsam' as const,
  sourceSignalSummary: { count: 1, latestKind: 'report' as const, latestAt: 1000 },
  workStatus: 'new' as const,
  preservationStatus: 'preReportHold' as const,
  ncmecStatus: 'awaitingManualFiling' as const,
  accountActionStatus: 'noAccountActionRequired' as const,
  reportDisposition: 'undetermined' as const,
  openHoldCount: 1,
  createdAt: 1000,
  updatedAt: 1000,
};

const BASE_CASE_ROOT_DOC = {
  schemaVersion: 1 as const,
  caseId: 'case-1',
  evidenceManifestId: 'em-1',
  currentReasonInternal: 'Child safety concern flagged',
};

describe('ChildSafetyCaseV1 — chatMessageLocator', () => {
  it('parses without the optional chat-report fields', () => {
    const result = ChildSafetyCaseV1Schema.safeParse(BASE_CASE_ROOT_DOC);
    expect(result.success).toBe(true);
  });

  it('parses with a guildChatMessage chatMessageLocator', () => {
    const result = ChildSafetyCaseV1Schema.safeParse({
      ...BASE_CASE_ROOT_DOC,
      chatMessageLocator: {
        kind: 'guildChatMessage',
        channelId: 'wp-1/chan-abc',
        messageId: 'msg-123',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.chatMessageLocator).toMatchObject({ kind: 'guildChatMessage' });
    }
  });

  it('parses with a guildInviteMessage chatMessageLocator (the other chat surface)', () => {
    const result = ChildSafetyCaseV1Schema.safeParse({
      ...BASE_CASE_ROOT_DOC,
      chatMessageLocator: {
        kind: 'guildInviteMessage',
        channelId: 'invite-chan',
        messageId: 'msg-123',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid chatMessageLocator shape', () => {
    const result = ChildSafetyCaseV1Schema.safeParse({
      ...BASE_CASE_ROOT_DOC,
      chatMessageLocator: {
        kind: 'guildChatMessage',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra unrecognized fields (.strict())', () => {
    const result = ChildSafetyCaseV1Schema.safeParse({
      ...BASE_CASE_ROOT_DOC,
      unexpectedField: 'oops',
    });
    expect(result.success).toBe(false);
  });
});

const BASE_NCII_CASE_DOC = {
  schemaVersion: 1 as const,
  caseId: 'ncii-1',
  revision: 0,
  lane: 'ncii' as const,
  internalStatus: 'open' as const,
  childSafetyLinkStatus: 'none' as const,
  crossover: { minorAssessment: 'unknown' as const, csamAssessment: 'notAssessed' as const },
  createdAt: 1000,
  updatedAt: 1000,
};

describe('a protected chat case opens complete, with no context-pending marker', () => {
  const cases = [
    ['case list', ChildSafetyCaseListV1Schema, BASE_CASE_LIST_DOC],
    ['case root', ChildSafetyCaseV1Schema, BASE_CASE_ROOT_DOC],
    ['NCII case', NciiCaseV1Schema, BASE_NCII_CASE_DOC],
  ] as const;

  it.each(cases)('a %s carrying contextResolutionPending does not parse', (_name, schema, doc) => {
    expect(schema.safeParse(doc).success).toBe(true);
    expect(schema.safeParse({ ...doc, contextResolutionPending: false }).success).toBe(false);
  });
});

describe('ChildSafetyCaseListV1 — testListDrill', () => {
  it('parses without testListDrill (absent = real case)', () => {
    const result = ChildSafetyCaseListV1Schema.safeParse(BASE_CASE_LIST_DOC);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.testListDrill).toBeUndefined();
    }
  });

  it('parses with testListDrill: true (drill case)', () => {
    const result = ChildSafetyCaseListV1Schema.safeParse({
      ...BASE_CASE_LIST_DOC,
      testListDrill: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.testListDrill).toBe(true);
    }
  });

  it('rejects testListDrill: false — the flag is present-and-true or absent, never false', () => {
    const result = ChildSafetyCaseListV1Schema.safeParse({
      ...BASE_CASE_LIST_DOC,
      testListDrill: false,
    });
    expect(result.success).toBe(false);
  });
});

describe('ChildSafetyCaseListV1 — no initial-review deadline', () => {
  it('a case needs only its creation time to order the queue — no review due date', () => {
    expect(ChildSafetyCaseListV1Schema.safeParse(BASE_CASE_LIST_DOC).success).toBe(true);
  });

  it('rejects a case that still carries a review due date', () => {
    expect(
      ChildSafetyCaseListV1Schema.safeParse({ ...BASE_CASE_LIST_DOC, reviewDueAt: 2000 }).success,
    ).toBe(false);
  });

  it('no monitor kind is an initial-review deadline', () => {
    expect(SafetySlaMonitorKindSchema.safeParse('reviewDue').success).toBe(false);
  });
});
