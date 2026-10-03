import { describe, it, expect } from 'vitest';
import { ChatParkedDeliveryReportSchema, type ChatParkedDeliveryReport } from '@ttt-productions/chat-schemas';
import { ChatParkedDeliverySchema } from '../src/doc-schemas/chat-sync';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry';
import { ERASURE_FATES_BY_COLLECTION_PATH } from '../src/doc-schemas/erasure-fates';
import { COLLECTIONS } from '../src/paths/collections';
import { PATH_BUILDERS } from '../src/paths/path-builders';
import { AdminReplayDeadLetterInputSchema, DeadLetterCollectionSchema, FlatDeadLetterCollectionSchema } from '../src/schemas/admin';
import { DEAD_LETTER_COLLECTION_LABELS } from '../src/constants/admin-labels';

const report: ChatParkedDeliveryReport = {
  targetDo: 'ttt:dev:inbox:u1',
  roomKind: 'inbox',
  eventId: 'evt-1',
  deliveryKind: 'read-clear',
  roomAttemptCount: 8,
  roomLastError: 'conflict',
  parkedAt: 1_000,
};

/** The row a report creates: parked, listed with every other dead-lettered row. */
const reported = {
  ...report,
  status: 'deadLetter' as const,
  attemptCount: 0,
  nextAttemptAt: 2_000,
  lastError: null,
  createdAt: 2_000,
  deadLetteredAt: 2_000,
  deliveredAt: null,
};

describe('a room parked delivery is recorded where Ops Repairs looks', () => {
  it('the stored row carries exactly what the room reported', () => {
    expect(ChatParkedDeliverySchema.parse(reported)).toEqual(reported);
    for (const key of Object.keys(ChatParkedDeliveryReportSchema.shape)) {
      expect(ChatParkedDeliverySchema.shape).toHaveProperty(key);
    }
  });

  it('a report the chat contract refuses cannot be stored either', () => {
    expect(ChatParkedDeliverySchema.safeParse({ ...reported, roomKind: 'worker' }).success).toBe(false);
    expect(ChatParkedDeliverySchema.safeParse({ ...reported, eventId: '' }).success).toBe(false);
  });

  it('the generic replay reset turns a parked row back into a pending one', () => {
    const replayed = {
      ...reported,
      status: 'pending' as const,
      attemptCount: 0,
      nextAttemptAt: 3_000,
      lastError: null,
      deadLetteredAt: null,
    };
    expect(ChatParkedDeliverySchema.safeParse(replayed).success).toBe(true);
  });

  it('is a flat replay lane with its own label, listed by the dead-letter lister', () => {
    expect(DeadLetterCollectionSchema.options).toContain('chatParkedDeliveries');
    expect(FlatDeadLetterCollectionSchema.options).toContain('chatParkedDeliveries');
    expect(DEAD_LETTER_COLLECTION_LABELS.chatParkedDeliveries.length).toBeGreaterThan(0);
    expect(
      AdminReplayDeadLetterInputSchema.safeParse({ collection: 'chatParkedDeliveries', docId: 'abc', reason: 'room fixed' }).success,
    ).toBe(true);
  });

  it('lives in its own registered collection with a declared erasure fate', () => {
    expect(PATH_BUILDERS.chatParkedDelivery('d1')).toEqual([COLLECTIONS.CHAT_PARKED_DELIVERIES, 'd1']);
    expect(COLLECTION_SCHEMAS['chatParkedDeliveries/{deliveryId}']).toBe(ChatParkedDeliverySchema);
    expect(ERASURE_FATES_BY_COLLECTION_PATH['chatParkedDeliveries/{deliveryId}']).toBeDefined();
  });
});
