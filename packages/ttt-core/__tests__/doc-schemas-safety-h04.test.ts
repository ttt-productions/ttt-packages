// Unit tests for H-04 V1 schema additions:
//   - `guildChatMessage` TargetLocatorV1 kind (foundation.ts)
//   - `contextResolutionPending` on ChildSafetyCaseListV1 (case.ts list doc)
//   - `chatMessageLocator` + `contextResolutionPending` on ChildSafetyCaseV1 (case.ts restricted root)
//
// These fields support the V1 fix: a protected-reason chat report that can't resolve context at
// intake opens a protected case with the immutable locator preserved, never downgrading to ordinary.

import { describe, it, expect } from 'vitest';
import { TargetLocatorV1Schema, TargetLocatorKindSchema } from '../src/doc-schemas/safety/foundation';
import {
  ChildSafetyCaseListV1Schema,
  ChildSafetyCaseV1Schema,
} from '../src/doc-schemas/safety/case';

// ---------------------------------------------------------------------------
// TargetLocatorV1 — guildChatMessage variant
// ---------------------------------------------------------------------------

describe('TargetLocatorV1 — guildChatMessage (H-04 V1)', () => {
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

  it('existing chatAttachment locator still parses (no regression)', () => {
    const result = TargetLocatorV1Schema.safeParse({
      kind: 'chatAttachment',
      channelId: 'wp-1/chan-abc',
      messageId: 'msg-123',
      attachmentId: 'att-456',
    });
    expect(result.success).toBe(true);
  });

  it('existing guildInviteMessage locator still parses (no regression)', () => {
    const result = TargetLocatorV1Schema.safeParse({
      kind: 'guildInviteMessage',
      channelId: 'invite-chan',
      messageId: 'msg-7',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ChildSafetyCaseListV1 — contextResolutionPending
// ---------------------------------------------------------------------------

/** Minimal valid ChildSafetyCaseListV1 fixture (all required fields). */
const BASE_CASE_LIST_DOC = {
  schemaVersion: 1 as const,
  caseId: 'case-1',
  revision: 0,
  canonicalIncidentKey: 'ik-1',
  incidentClass: 'apparentCsam' as const,
  sourceSignalSummary: { count: 1, latestKind: 'report' as const, latestAt: 1000 },
  workStatus: 'new' as const,
  preservationStatus: 'preReportHold' as const,
  ncmecStatus: 'queued' as const,
  accountActionStatus: 'noAccountActionRequired' as const,
  reportDisposition: 'undetermined' as const,
  reviewDueAt: 2000,
  openHoldCount: 1,
  mergeState: 'none' as const,
  createdAt: 1000,
  updatedAt: 1000,
};

describe('ChildSafetyCaseListV1 — contextResolutionPending (H-04 V1)', () => {
  it('parses without contextResolutionPending (absent = false by convention)', () => {
    const result = ChildSafetyCaseListV1Schema.safeParse(BASE_CASE_LIST_DOC);
    expect(result.success).toBe(true);
  });

  it('parses with contextResolutionPending: true', () => {
    const result = ChildSafetyCaseListV1Schema.safeParse({
      ...BASE_CASE_LIST_DOC,
      contextResolutionPending: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contextResolutionPending).toBe(true);
    }
  });

  it('parses with contextResolutionPending: false', () => {
    const result = ChildSafetyCaseListV1Schema.safeParse({
      ...BASE_CASE_LIST_DOC,
      contextResolutionPending: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contextResolutionPending).toBe(false);
    }
  });

  it('rejects non-boolean contextResolutionPending', () => {
    const result = ChildSafetyCaseListV1Schema.safeParse({
      ...BASE_CASE_LIST_DOC,
      contextResolutionPending: 'yes',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ChildSafetyCaseV1 — chatMessageLocator + contextResolutionPending
// ---------------------------------------------------------------------------

/** Minimal valid ChildSafetyCaseV1 fixture (all required fields). */
const BASE_CASE_ROOT_DOC = {
  schemaVersion: 1 as const,
  caseId: 'case-1',
  evidenceManifestId: 'em-1',
  currentReasonInternal: 'Child safety concern flagged',
};

describe('ChildSafetyCaseV1 — chatMessageLocator + contextResolutionPending (H-04 V1)', () => {
  it('parses without the new optional fields (no regression)', () => {
    const result = ChildSafetyCaseV1Schema.safeParse(BASE_CASE_ROOT_DOC);
    expect(result.success).toBe(true);
  });

  it('parses with guildChatMessage chatMessageLocator + contextResolutionPending: true', () => {
    const result = ChildSafetyCaseV1Schema.safeParse({
      ...BASE_CASE_ROOT_DOC,
      chatMessageLocator: {
        kind: 'guildChatMessage',
        channelId: 'wp-1/chan-abc',
        messageId: 'msg-123',
      },
      contextResolutionPending: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.chatMessageLocator).toMatchObject({ kind: 'guildChatMessage' });
      expect(result.data.contextResolutionPending).toBe(true);
    }
  });

  it('parses with chatAttachment chatMessageLocator (media-resolved case with locator)', () => {
    const result = ChildSafetyCaseV1Schema.safeParse({
      ...BASE_CASE_ROOT_DOC,
      chatMessageLocator: {
        kind: 'chatAttachment',
        channelId: 'wp-1/chan-abc',
        messageId: 'msg-123',
        attachmentId: 'att-456',
      },
      contextResolutionPending: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid chatMessageLocator shape', () => {
    const result = ChildSafetyCaseV1Schema.safeParse({
      ...BASE_CASE_ROOT_DOC,
      chatMessageLocator: {
        kind: 'guildChatMessage',
        // missing channelId and messageId
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

  it('contextResolutionPending: false on a normal (non-pending) media case is valid', () => {
    const result = ChildSafetyCaseV1Schema.safeParse({
      ...BASE_CASE_ROOT_DOC,
      contextResolutionPending: false,
    });
    expect(result.success).toBe(true);
  });
});
