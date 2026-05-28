import { describe, it, expectTypeOf } from 'vitest';
import type {
  AuditEventType,
  TTTAuditActor,
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
      'social.userFollowed',
      'chat.guildChatMessageSent',
      'craftSkill.userCraftSkillDeleted',
      'audition.entryCreated',
    ];
    expectTypeOf(sample).toEqualTypeOf<AuditEventType[]>();
  });

  it('TTTAuditActor has uid and isAdmin', () => {
    expectTypeOf<TTTAuditActor>().toEqualTypeOf<{
      uid: string | null;
      isAdmin: boolean;
    }>();
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
      actor: { uid: 'u1', isAdmin: false },
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
