import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  AuditEventType,
  TTTAuditActor,
  TTTAuditActorBase,
  TTTAuditActorMode,
  TTTAuditTarget,
  TTTAuditEvent,
} from '../src/types/audit';
import { TTTAuditEventSchema } from '../src/doc-schemas/audit';

describe('audit type catalog', () => {
  it('AuditEventType includes representative members from each domain', () => {
    const sample: AuditEventType[] = [
      'user.accountRegistered',
      'admin.systemRoleGranted',
      'workProject.created',
      'content.taleWorkGenresUpdated',
      'payment.pledgePaymentCompleted',
      'system.manualIntervention',
      'social.targetFollowed',
      'craftSkill.userCraftSkillDeleted',
      'audition.entryCreated',
      'audition.curatedBatchFailed',
      'workProject.fileFolderAccessChanged',
      // fable-review campaign additions
      'chat.guildChatChannelDeleted',
      // channel lifecycle symmetry — the archive lane's inverse
      'chat.guildChatChannelUnarchived',
      'payment.pledgePaymentRefunded',
      'payment.pledgePaymentDisputeOpened',
      'payment.pledgePaymentDisputeClosed',
      'payment.pledgeRefundRequested',
      'payment.pledgeRefundRequestResolved',
      'hallItem.moderationPlaceholderApplied',
      'ncii.evidenceMarked',
      // [P2-08] privileged raw-locator read (distinct from safety.privilegedReauthPerformed)
      'safety.privilegedRawLocatorRead',
      // versioned public documents: the release and the (only) acceptance history
      'publicDocuments.released',
      'publicDocuments.accepted',
      // the Square posting agreements acceptance
      'social.squareStreetzAgreementsAccepted',
    ];
    expectTypeOf(sample).toEqualTypeOf<AuditEventType[]>();
  });

  it('AuditEventType covers every realm-file promotion transition and folder mutation', () => {
    // The approval gate is only auditable if EACH transition has its own type: a request and
    // its resolution must be a traceable pair, and a folder rename must be distinguishable
    // from a create or a delete.
    const realmFileEvents: AuditEventType[] = [
      'workFile.realmShareRequested',
      'workFile.realmShareRequestWithdrawn',
      'workFile.realmSharePromotionApproved',
      'workFile.realmSharePromotionDeclined',
      'workFile.realmFileFolderAssignmentChanged',
      'workFile.realmCanonChanged',
      'workFile.unsharedFromRealm',
      'workRealm.fileFolderCreated',
      'workRealm.fileFolderUpdated',
      'workRealm.fileFolderDeleted',
    ];
    expectTypeOf(realmFileEvents).toEqualTypeOf<AuditEventType[]>();
  });

  it('rejects plausible-but-wrong realm-file event names (the union stays exhaustive)', () => {
    // @ts-expect-error — the approval-gate events are namespaced workFile.realmShare*, not this.
    const wrongNamespace: AuditEventType = 'realmFile.shareRequested';
    // @ts-expect-error — realm folders are workRealm.fileFolder*, mirroring workProject.fileFolder*.
    const wrongFolderName: AuditEventType = 'workRealm.realmFileFolderCreated';
    void wrongNamespace;
    void wrongFolderName;
  });

  it('AuditEventType has no commission-deletion member (closing is the only terminal transition)', () => {
    // @ts-expect-error — 'workProject.commissionDeleted' was removed with the delete lane.
    const removed: AuditEventType = 'workProject.commissionDeleted';
    void removed;

    const kept: AuditEventType = 'workProject.commissionClosed';
    void kept;
  });

  it('TTTAuditActorBase carries the shared fields', () => {
    expectTypeOf<TTTAuditActorBase>().toEqualTypeOf<{
      uid: string | null;
      isAdmin: boolean;
    }>();
  });

  it('the Work-membership actor mode is guildmateUser — projectMember is the retired name', () => {
    // ARCH-107 / terminology-naming-convention.md: the bare `member` / `projectMember` noun
    // renames to `guildmateUser` everywhere a code identifier is involved.
    const guildmate: TTTAuditActorMode = 'guildmateUser';
    void guildmate;

    // @ts-expect-error — 'projectMember' is the retired identifier; it is not a member of the union.
    const retired: TTTAuditActorMode = 'projectMember';
    void retired;

    const actor: TTTAuditActor = { uid: 'u1', isAdmin: false, actorMode: 'guildmateUser' };
    expectTypeOf(actor).toMatchTypeOf<TTTAuditActor>();

    // @ts-expect-error — a guildmateUser actor must not carry a systemRole (non-admin mode).
    const spurious: TTTAuditActor = { uid: 'u1', isAdmin: false, actorMode: 'guildmateUser', systemRole: 'admin' };
    void spurious;
  });

  it('the registry schema enum agrees with the type union (guildmateUser in, projectMember out)', () => {
    const event = {
      id: 'evt-1',
      type: 'workProject.created',
      schemaVersion: 1,
      target: null,
      timestamp: 0,
      ip: null,
      userAgent: null,
      region: null,
      metadata: {},
      result: 'success',
      failureReason: null,
      correlationId: null,
    };
    expect(
      TTTAuditEventSchema.safeParse({
        ...event,
        actor: { uid: 'u1', isAdmin: false, actorMode: 'guildmateUser' },
      }).success,
    ).toBe(true);
    expect(
      TTTAuditEventSchema.safeParse({
        ...event,
        actor: { uid: 'u1', isAdmin: false, actorMode: 'projectMember' },
      }).success,
    ).toBe(false);
  });

  it('TTTAuditActor requires systemRole on admin modes and forbids it otherwise', () => {
    // Non-admin mode: systemRole is not set.
    const nonAdmin: TTTAuditActor = {
      uid: 'u1',
      isAdmin: false,
      actorMode: 'user',
    };
    expectTypeOf(nonAdmin).toMatchTypeOf<TTTAuditActor>();

    // Admin mode: systemRole is required and present.
    const adminActor: TTTAuditActor = {
      uid: 'admin1',
      isAdmin: true,
      actorMode: 'adminOverride',
      systemRole: 'admin',
    };
    expectTypeOf(adminActor).toMatchTypeOf<TTTAuditActor>();

    // @ts-expect-error — an admin-mode actor without systemRole is unrepresentable.
    const missingRole: TTTAuditActor = { uid: 'admin2', isAdmin: true, actorMode: 'adminReview' };

    // @ts-expect-error — a non-admin actor must not carry a systemRole.
    const spuriousRole: TTTAuditActor = { uid: 'u2', isAdmin: false, actorMode: 'user', systemRole: 'admin' };

    void missingRole;
    void spuriousRole;
  });

  it('TTTAuditTarget has uid and ref', () => {
    expectTypeOf<TTTAuditTarget>().toEqualTypeOf<{
      uid: string | null;
      ref: string | null;
    }>();
  });

  it('TTTAuditEvent specializes the package generic with TTT shapes', () => {
    const sample: TTTAuditEvent = {
      id: 'evt-1',
      type: 'user.accountRegistered',
      schemaVersion: 1,
      actor: { uid: 'u1', isAdmin: false, actorMode: 'user' },
      target: null,
      timestamp: 0,
      ip: null,
      userAgent: null,
      region: null,
      metadata: {},
      result: 'success',
      failureReason: null,
      correlationId: null,
    };
    expectTypeOf(sample).toEqualTypeOf<TTTAuditEvent>();
  });
});

describe('sign-up age check', () => {
  it('has no audit event type of its own — the account-registered event records the bracket', () => {
    // @ts-expect-error — the birthday screen writes no audit record, so no such event type exists.
    const ageAttested: AuditEventType = 'user.ageAttested';
    const registered: AuditEventType = 'user.accountRegistered';
    expect([ageAttested, registered]).toHaveLength(2);
  });
});

describe('credential and session records', () => {
  it('has a type for the sign-in record and for a completed password reset — the credential records something writes', () => {
    const credentialEvents: AuditEventType[] = ['user.signedIn', 'user.passwordResetCompleted'];
    expect(new Set(credentialEvents).size).toBe(credentialEvents.length);
  });

  it('has no type for a credential change no flow performs: a password change, an email change, an email recovery', () => {
    // @ts-expect-error — there is no in-app password change, so nothing records one.
    const passwordChanged: AuditEventType = 'user.passwordChanged';
    // @ts-expect-error — there is no in-app email change, so nothing records one.
    const emailChanged: AuditEventType = 'user.emailChanged';
    // @ts-expect-error — an email recovery has no server step that could record it.
    const emailRecovered: AuditEventType = 'user.emailRecovered';
    expect([passwordChanged, emailChanged, emailRecovered]).toHaveLength(3);
  });
});

describe('the catalog names only events something writes', () => {
  it('has no per-page public-document seed or edit events — a release is the record of every public-document change', () => {
    const released: AuditEventType = 'publicDocuments.released';
    // @ts-expect-error — public documents change only through a release.
    const futurePlansSeeded: AuditEventType = 'admin.futurePlansSeeded';
    // @ts-expect-error — public documents change only through a release.
    const futurePlansUpdated: AuditEventType = 'admin.futurePlansUpdated';
    // @ts-expect-error — public documents change only through a release.
    const privacyPageSeeded: AuditEventType = 'admin.privacyPageSeeded';
    // @ts-expect-error — public documents change only through a release.
    const privacyPageUpdated: AuditEventType = 'admin.privacyPageUpdated';
    // @ts-expect-error — public documents change only through a release.
    const rulesSeeded: AuditEventType = 'admin.rulesAndAgreementsSeeded';
    // @ts-expect-error — public documents change only through a release.
    const rulesUpdated: AuditEventType = 'admin.rulesAndAgreementsUpdated';
    // @ts-expect-error — public documents change only through a release.
    const takeItDownCopySeeded: AuditEventType = 'admin.takeItDownPageCopySeeded';
    // @ts-expect-error — public documents change only through a release.
    const takeItDownCopyUpdated: AuditEventType = 'admin.takeItDownPageCopyUpdated';
    // @ts-expect-error — public documents change only through a release.
    const termsSeeded: AuditEventType = 'admin.termsPageSeeded';
    // @ts-expect-error — public documents change only through a release.
    const termsUpdated: AuditEventType = 'admin.termsPageUpdated';
    expect([
      released,
      futurePlansSeeded,
      futurePlansUpdated,
      privacyPageSeeded,
      privacyPageUpdated,
      rulesSeeded,
      rulesUpdated,
      takeItDownCopySeeded,
      takeItDownCopyUpdated,
      termsSeeded,
      termsUpdated,
    ]).toHaveLength(11);
  });

  it('records a Realm file share by its request and approval, and a Realm by its release, with no instant-share or creation event', () => {
    const shareApproved: AuditEventType = 'workFile.realmSharePromotionApproved';
    const realmReleased: AuditEventType = 'workRealm.released';
    // @ts-expect-error — a file reaches a Realm only through an approved share request.
    const sharedToRealm: AuditEventType = 'workFile.sharedToRealm';
    // @ts-expect-error — a Realm is recorded when it is released.
    const realmCreated: AuditEventType = 'workRealm.created';
    expect([shareApproved, realmReleased, sharedToRealm, realmCreated]).toHaveLength(4);
  });

  it('keeps the child-safety events something writes, and the two the legal-process intake owes', () => {
    const written: AuditEventType[] = ['childSafety.holdReleased', 'childSafety.quarantineCompleted'];
    const owedByLegalProcessIntake: AuditEventType[] = ['childSafety.legalProcessRecorded', 'childSafety.evidenceDisposed'];
    // @ts-expect-error — nothing records a hold placement as an event of its own.
    const holdPlaced: AuditEventType = 'childSafety.holdPlaced';
    // @ts-expect-error — nothing records an account-action reversal.
    const accountActionReverted: AuditEventType = 'childSafety.accountActionReverted';
    // @ts-expect-error — the evidence manifest is itself the chain-of-custody record.
    const manifestCreated: AuditEventType = 'childSafety.evidenceManifestCreated';
    expect([...written, ...owedByLegalProcessIntake, holdPlaced, accountActionReverted, manifestCreated]).toHaveLength(7);
  });

  it('keeps the NCII intake event, with no event for a step nothing records', () => {
    const received: AuditEventType = 'ncii.requestReceived';
    // @ts-expect-error — nothing records this step.
    const scanMatch: AuditEventType = 'ncii.evidenceScanValidatedMatch';
    // @ts-expect-error — nothing records this step.
    const completeness: AuditEventType = 'ncii.completenessDetermined';
    // @ts-expect-error — nothing records this step.
    const supplemented: AuditEventType = 'ncii.requestSupplemented';
    // @ts-expect-error — nothing records this step.
    const hashBlockReversed: AuditEventType = 'ncii.hashBlockReversed';
    // @ts-expect-error — nothing records this step.
    const policyConfigUpdated: AuditEventType = 'ncii.policyConfigUpdated';
    expect([received, scanMatch, completeness, supplemented, hashBlockReversed, policyConfigUpdated]).toHaveLength(6);
  });

  it('has no reviewer-capability grant or revocation events — nothing records either', () => {
    // @ts-expect-error — nothing records a reviewer-capability grant.
    const granted: AuditEventType = 'safety.reviewerCapabilityGranted';
    // @ts-expect-error — nothing records a reviewer-capability revocation.
    const revoked: AuditEventType = 'safety.reviewerCapabilityRevoked';
    expect([granted, revoked]).toHaveLength(2);
  });
});

describe('short-link audit types', () => {
  it('has no short-link deletion event — a short link is never deleted', () => {
    // @ts-expect-error — a short link is never deleted, so no deletion event exists.
    const removed: AuditEventType = 'admin.shortLinkDeleted';
    void removed;
  });
});

describe('support thread audit types', () => {
  it('has no thread-deletion event — a thread is closed, never deleted', () => {
    // @ts-expect-error — a support thread is closed, never deleted, so no thread-deletion event exists.
    const removed: AuditEventType = 'admin.dispatchDeleted';
    void removed;

    const closed: AuditEventType = 'chat.adminThreadStatusChanged';
    void closed;
  });
});
