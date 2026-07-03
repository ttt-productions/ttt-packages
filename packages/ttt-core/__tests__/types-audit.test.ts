import { describe, it, expectTypeOf } from 'vitest';
import type {
  AuditEventType,
  TTTAuditActor,
  TTTAuditActorBase,
  TTTAuditTarget,
  TTTAuditEvent,
} from '../src/types/audit';

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
      'workProject.fileFolderAccessChanged',
    ];
    expectTypeOf(sample).toEqualTypeOf<AuditEventType[]>();
  });

  it('TTTAuditActorBase carries the shared fields', () => {
    expectTypeOf<TTTAuditActorBase>().toEqualTypeOf<{
      uid: string | null;
      isAdmin: boolean;
    }>();
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
