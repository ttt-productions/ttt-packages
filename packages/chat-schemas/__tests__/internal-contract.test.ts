import { describe, it, expect } from 'vitest';
import * as chatSchemas from '../src/index.js';
import { CHAT_INTERNAL_BODY_MAX_BYTES } from '../src/internal-contract.js';

describe('chat internal-endpoint body budget', () => {
  it('is a positive whole number of bytes', () => {
    expect(Number.isSafeInteger(CHAT_INTERNAL_BODY_MAX_BYTES)).toBe(true);
    expect(CHAT_INTERNAL_BODY_MAX_BYTES).toBeGreaterThan(0);
  });

  it('is exported from the package root, so the Worker and the signer import the one value', () => {
    expect(chatSchemas.CHAT_INTERNAL_BODY_MAX_BYTES).toBe(CHAT_INTERNAL_BODY_MAX_BYTES);
  });
});

describe('a room parked-delivery report', () => {
  // The widest UTF-8 character a single UTF-16 code unit can be (3 bytes), so the byte count —
  // not the character count — is what is measured.
  const wide = (length: number) => '\u20ac'.repeat(length);
  const largestValidReport = {
    targetDo: wide(chatSchemas.CHAT_ROOM_TARGET_MAX_LENGTH),
    roomKind: 'channel' as const,
    eventId: wide(chatSchemas.CHAT_OUTBOX_EVENT_ID_MAX_LENGTH),
    deliveryKind: wide(chatSchemas.CHAT_DELIVERY_KIND_MAX_LENGTH),
    roomAttemptCount: Number.MAX_SAFE_INTEGER,
    roomLastError: wide(chatSchemas.CHAT_PARKED_DELIVERY_ERROR_MAX_LENGTH),
    parkedAt: Number.MAX_SAFE_INTEGER,
  };

  it('names the room, its parked row, and when it parked', () => {
    expect(chatSchemas.ChatParkedDeliveryReportSchema.parse(largestValidReport)).toEqual(largestValidReport);
  });

  it('fits inside its body budget at its largest, so a valid report is never refused for size', () => {
    const bytes = new TextEncoder().encode(JSON.stringify(largestValidReport)).length;
    expect(bytes).toBeLessThanOrEqual(chatSchemas.CHAT_PARKED_DELIVERY_REPORT_MAX_BODY_BYTES);
  });

  it('every valid conversation has a reportable room — the largest reference fits the room address bound', () => {
    const kind = 'k'.repeat(chatSchemas.CHAT_CONVERSATION_KIND_MAX_LENGTH);
    const id = 'i'.repeat(chatSchemas.CHAT_CONVERSATION_ID_MAX_LENGTH);
    expect(chatSchemas.ChatConversationRefSchema.safeParse({ kind, id }).success).toBe(true);
    // The Worker's room address: a product, an environment, the room kind, the conversation kind and id.
    const targetDo = `ttt:prod:channel:${kind}:${id}`;
    expect(chatSchemas.ChatParkedDeliveryReportSchema.safeParse({ ...largestValidReport, targetDo }).success).toBe(true);
  });

  it('refuses a report for a room kind that keeps no outbox, and any extra field', () => {
    expect(chatSchemas.ChatParkedDeliveryReportSchema.safeParse({ ...largestValidReport, roomKind: 'worker' }).success).toBe(false);
    expect(chatSchemas.ChatParkedDeliveryReportSchema.safeParse({ ...largestValidReport, text: 'hi' }).success).toBe(false);
  });

  it('refuses a report with no room or no row to replay', () => {
    expect(chatSchemas.ChatParkedDeliveryReportSchema.safeParse({ ...largestValidReport, targetDo: '' }).success).toBe(false);
    expect(chatSchemas.ChatParkedDeliveryReportSchema.safeParse({ ...largestValidReport, eventId: '' }).success).toBe(false);
  });
});

describe('a parked-delivery replay', () => {
  it('names the room and the parked row', () => {
    expect(chatSchemas.ChatParkedDeliveryReplayRequestSchema.parse({ targetDo: 'room', eventId: 'e1' })).toEqual({ targetDo: 'room', eventId: 'e1' });
    expect(chatSchemas.ChatParkedDeliveryReplayRequestSchema.safeParse({ targetDo: 'room' }).success).toBe(false);
  });

  it('is answered requeued, or not-parked when the room holds no such parked row', () => {
    expect(chatSchemas.CHAT_PARKED_DELIVERY_REPLAY_OUTCOMES).toEqual(['requeued', 'not-parked']);
    expect(chatSchemas.ChatParkedDeliveryReplayResultSchema.safeParse({ outcome: 'delivered' }).success).toBe(false);
  });
});

describe('a server-written message keeps the accounts it names beside its text', () => {
  it('carries the sender, the text, and the referenced account ids', () => {
    const payload = { senderId: chatSchemas.CHAT_SYSTEM_SENDER_ID, text: 'x', referencedUids: ['u1'] };
    expect(chatSchemas.ChatServerMessagePayloadSchema.parse(payload)).toEqual(payload);
  });

  it('bounds the referenced ids and the text, and refuses any other field', () => {
    const base = { senderId: chatSchemas.CHAT_SYSTEM_SENDER_ID, text: 'x' };
    const tooMany = Array.from({ length: chatSchemas.CHAT_MESSAGE_REFERENCED_UIDS_MAX + 1 }, (_, i) => `u${i}`);
    expect(chatSchemas.ChatServerMessagePayloadSchema.safeParse({ ...base, referencedUids: tooMany }).success).toBe(false);
    expect(chatSchemas.ChatServerMessagePayloadSchema.safeParse({ ...base, referencedUids: [''] }).success).toBe(false);
    expect(
      chatSchemas.ChatServerMessagePayloadSchema.safeParse({ ...base, text: 'x'.repeat(chatSchemas.CHAT_MESSAGE_TEXT_MAX_LENGTH + 1) }).success,
    ).toBe(false);
    expect(chatSchemas.ChatServerMessagePayloadSchema.safeParse({ ...base, replyTo: 'm1' }).success).toBe(false);
  });
});
