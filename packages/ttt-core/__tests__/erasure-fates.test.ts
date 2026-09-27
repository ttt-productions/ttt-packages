import { describe, it, expect } from 'vitest';
import {
  ERASURE_FATES,
  ERASURE_FATES_BY_COLLECTION_PATH,
  adminDispatchErasureFate,
  collectionPathsWithErasureFate,
} from '../src/doc-schemas/erasure-fates';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry';
import * as docSchemasBarrel from '../src/doc-schemas';

const fatesOf = (path: string): readonly string[] =>
  (ERASURE_FATES_BY_COLLECTION_PATH as Record<string, readonly string[]>)[path];

describe('erasure fate declaration', () => {
  it('declares a fate for every registered collection path, and only those', () => {
    expect(Object.keys(ERASURE_FATES_BY_COLLECTION_PATH).sort()).toEqual(Object.keys(COLLECTION_SCHEMAS).sort());
  });

  it('declares at least one known fate per path, each at most once', () => {
    for (const [path, fates] of Object.entries(ERASURE_FATES_BY_COLLECTION_PATH)) {
      expect(fates.length, path).toBeGreaterThan(0);
      expect(new Set(fates).size, path).toBe(fates.length);
      for (const fate of fates) expect(ERASURE_FATES, path).toContain(fate);
    }
  });

  it('never pairs `none` with another fate', () => {
    for (const [path, fates] of Object.entries(ERASURE_FATES_BY_COLLECTION_PATH)) {
      if ((fates as readonly string[]).includes('none')) expect(fates, path).toEqual(['none']);
    }
  });

  it("deletes the Playbill data, the like history, own-thread files, and an ordinary report's submission record", () => {
    expect(fatesOf('userProfiles/{userId}/privateData/hallLibraryPreferences')).toEqual(['delete']);
    expect(fatesOf('userProfiles/{userId}/userLikes/likeHistory/squareStreetzLikes/{postId}')).toEqual(['delete']);
    expect(fatesOf('pendingAdminDispatches/{adminDispatchId}/conversationFiles/{conversationFileId}')).toContain(
      'delete',
    );
    expect(fatesOf('eventProvenance/{eventId}')).toEqual(['delete', 'retain']);
  });

  it('keeps the audit log and the payment ledger', () => {
    expect(fatesOf('auditEvents/{eventId}')).toEqual(['retain']);
    expect(fatesOf('pledgePayments/{pledgePaymentId}')).toEqual(['retain']);
  });

  it('lists the paths an erasure must act on by fate', () => {
    const deleted = collectionPathsWithErasureFate('delete');
    expect(deleted).toContain('userProfiles/{userId}/privateData/{userId}');
    expect(deleted).toContain('pendingAdminDispatches/{adminDispatchId}');
    expect(deleted).not.toContain('auditEvents/{eventId}');
    expect(collectionPathsWithErasureFate('anonymize')).toContain('publicUsers/{uid}');
    for (const path of collectionPathsWithErasureFate('none')) expect(fatesOf(path)).toEqual(['none']);
  });

  it('is exported from the doc-schemas entry point', () => {
    expect(docSchemasBarrel.ERASURE_FATES_BY_COLLECTION_PATH).toBe(ERASURE_FATES_BY_COLLECTION_PATH);
    expect(docSchemasBarrel.adminDispatchErasureFate).toBe(adminDispatchErasureFate);
  });
});

describe('support-thread erasure fate', () => {
  const erased = 'erased-uid';

  it('deletes a user-party thread the member started', () => {
    expect(adminDispatchErasureFate({ partyKind: 'user', initiatedBy: 'user', userId: erased }, erased)).toBe('delete');
  });

  it("keeps another member's thread the erased account took part in — an erased admin's replies never delete it", () => {
    expect(
      adminDispatchErasureFate({ partyKind: 'user', initiatedBy: 'user', userId: 'other-member' }, erased),
    ).toBe('anonymize');
  });

  it('keeps a thread the admin team started to the member, showing them as Former Member', () => {
    expect(adminDispatchErasureFate({ partyKind: 'user', initiatedBy: 'admin', userId: erased }, erased)).toBe(
      'anonymize',
    );
  });

  it('keeps a Work thread the member started, showing them as Former Member', () => {
    expect(
      adminDispatchErasureFate({ partyKind: 'workProject', initiatedBy: 'user', userId: erased }, erased),
    ).toBe('anonymize');
    expect(
      adminDispatchErasureFate({ partyKind: 'workProject', initiatedBy: 'admin', userId: erased }, erased),
    ).toBe('anonymize');
  });
});

describe('pending-media rows', () => {
  it("deletes a rejected upload's row with its violation and blanks every other row", () => {
    expect(fatesOf('pendingMedia/{pendingMediaId}')).toEqual(['delete', 'anonymize']);
    expect(fatesOf('pendingMediaArchive/{pendingMediaId}')).toEqual(['delete', 'anonymize']);
  });
});

describe('surfaces another party or a retained record depends on', () => {
  it('removes the member from a shared suggestion and keeps the suggestion', () => {
    expect(fatesOf('feedbackSubmissions/{feedbackType}/userSuggestions/{suggestionId}')).toEqual(['anonymize']);
  });

  it('keeps a Hall change request and a refund request with the member as an account id', () => {
    expect(fatesOf('hallContentChangeRequests/{changeRequestId}')).toEqual(['retain']);
    expect(fatesOf('pledgeRefundRequests/{requestId}')).toEqual(['retain']);
  });

  it('deletes the files the member uploaded in an invite conversation and keeps the other party\'s', () => {
    expect(fatesOf('guildInviteConversations/{guildInviteId}/conversationFiles/{conversationFileId}')).toEqual([
      'delete',
      'retain',
    ]);
  });

  it('deletes every notification sent to the member and keeps another recipient\'s that names them', () => {
    for (const path of [
      'activeUserNotifications/{notificationId}',
      'pendingNotifications/{notificationId}',
      'notificationDeliveries/{deliveryId}',
    ]) {
      expect(fatesOf(path), path).toEqual(['delete', 'retain']);
    }
    expect(fatesOf('userProfiles/{userId}/notificationHistory/{notificationId}')).toEqual(['delete']);
    expect(fatesOf('notificationArchiveAllJobs/{jobId}')).toEqual(['delete']);
    expect(fatesOf('activeAdminNotifications/{notificationId}')).toEqual(['retain']);
  });

  it('deletes an admin\'s step-up security record', () => {
    expect(fatesOf('operatorStepUp/{uid}')).toEqual(['delete']);
  });
});

describe('records kept for another party, the money trail, or compliance', () => {
  it('keeps the invite, the money records, the erasure record, short links, and reports about the member', () => {
    for (const path of [
      'guildInviteConversations/{guildInviteId}',
      'pledgePaymentProviderRefs/{pledgePaymentId}',
      'pledgePaymentLedgerEvents/{ledgerId}',
      'paymentWebhookQuarantine/{stripeEventId}',
      'accountDeletionRequests/{uid}',
      'shortLinks/{shortId}',
      'contentReports/{reportId}/privateDetails/snapshot',
      'activeReportGroups/{groupKey}',
    ]) {
      expect(fatesOf(path), path).toEqual(['retain']);
    }
    expect(fatesOf('contentReports/{reportId}')).toContain('retain');
    expect(fatesOf('eventProvenance/{eventId}')).toEqual(['delete', 'retain']);
  });

  it('lets the account-status queue entry drain itself', () => {
    expect(fatesOf('statusReconcileQueue/{uid}')).toEqual(['delete']);
  });
});

describe('work that would otherwise act for the erased account after the scrub', () => {
  it('deletes the member-authored announcement jobs and unapplied opening messages', () => {
    expect(fatesOf('squareAnnouncementJobs/{jobId}')).toEqual(['delete', 'retain']);
    expect(fatesOf('chatMessageOutbox/{commandId}')).toEqual(['delete', 'retain']);
  });

  it('deletes the member\'s chat membership projections and removes an erased admin from the roster', () => {
    expect(fatesOf('chatChannelAuthProjections/{authPairKey}')).toEqual(['delete']);
    expect(fatesOf('_systemData/adminList')).toEqual(['anonymize']);
  });

  it('keeps activation jobs and anonymization jobs as the closed records of work the erasure finished', () => {
    expect(fatesOf('mediaActivationJobs/{jobId}')).toEqual(['retain']);
    expect(fatesOf('chatHistoryAnonymizationJobs/{jobId}')).toEqual(['retain']);
  });
});
