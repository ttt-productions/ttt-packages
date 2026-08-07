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
      'content.taleDetailsUpdated',
      'payment.pledgePaymentCompleted',
      'system.manualIntervention',
      'social.targetFollowed',
      'craftSkill.userCraftSkillDeleted',
      'audition.entryCreated',
      'audition.curatedBatchFailed',
      'admin.dispatchDeleted',
      'admin.shortLinkDeleted',
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
