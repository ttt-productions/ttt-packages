import { describe, it, expect } from 'vitest';
import {
  CHAT_DELIVERY_KIND_MAX_LENGTH,
  CHAT_INTERNAL_BODY_MAX_BYTES,
  CHAT_INTERNAL_CALL_DIRECTIONS,
  CHAT_OUTBOX_COMMAND_KINDS,
  CHAT_OUTBOX_EVENT_ID_MAX_LENGTH,
  CHAT_PARKED_DELIVERY_ERROR_MAX_LENGTH,
  CHAT_PARKED_DELIVERY_REPLAY_OUTCOMES,
  CHAT_PARKED_DELIVERY_REPORT_CONTENT_TYPE,
  CHAT_PARKED_DELIVERY_REPORT_MAX_BODY_BYTES,
  CHAT_SYNC_APPLY_KINDS,
  ChatOutboxAppendRequestSchema,
  ChatParkedDeliveryReplayRequestSchema,
  ChatParkedDeliveryReplayResultSchema,
  ChatParkedDeliveryReportSchema,
  ChatServerMessagePayloadSchema,
  ChatSyncApplyRequestSchema,
  ChatWordListSnapshotSchema,
  chatInternalAudience,
  chatParkedDeliveryReportOperationId,
} from '../src/internal-contract.js';
import {
  CHAT_DIGEST_MAX_LENGTH,
  CHAT_INTERNAL_OPERATION_ID_MAX_LENGTH,
  CHAT_ROOM_TARGET_MAX_LENGTH,
} from '../src/internal-atoms.js';
import {
  CHAT_CONVERSATION_ID_MAX_LENGTH,
  CHAT_CONVERSATION_KIND_MAX_LENGTH,
  CHAT_GRANT_AUDIENCE,
  CHAT_MESSAGE_REFERENCED_UIDS_MAX,
  CHAT_MESSAGE_TEXT_MAX_LENGTH,
  CHAT_SYSTEM_SENDER_ID,
  ChatConversationRefSchema,
} from '../src/realtime-wire.js';

describe('chat internal-endpoint body budget', () => {
  it('is a positive whole number of bytes', () => {
    expect(Number.isSafeInteger(CHAT_INTERNAL_BODY_MAX_BYTES)).toBe(true);
    expect(CHAT_INTERNAL_BODY_MAX_BYTES).toBeGreaterThan(0);
  });
});

describe('a room parked-delivery report', () => {
  // The widest UTF-8 character a single UTF-16 code unit can be (3 bytes), so the byte count —
  // not the character count — is what is measured.
  const wide = (length: number) => '\u20ac'.repeat(length);
  const largestValidReport = {
    targetDo: wide(CHAT_ROOM_TARGET_MAX_LENGTH),
    roomKind: 'channel' as const,
    eventId: wide(CHAT_OUTBOX_EVENT_ID_MAX_LENGTH),
    deliveryKind: wide(CHAT_DELIVERY_KIND_MAX_LENGTH),
    roomAttemptCount: Number.MAX_SAFE_INTEGER,
    roomLastError: wide(CHAT_PARKED_DELIVERY_ERROR_MAX_LENGTH),
    parkedAt: Number.MAX_SAFE_INTEGER,
  };

  it('names the room, its parked row, and when it parked', () => {
    expect(ChatParkedDeliveryReportSchema.parse(largestValidReport)).toEqual(largestValidReport);
  });

  it('fits inside its body budget at its largest, so a valid report is never refused for size', () => {
    const bytes = new TextEncoder().encode(JSON.stringify(largestValidReport)).length;
    expect(bytes).toBeLessThanOrEqual(CHAT_PARKED_DELIVERY_REPORT_MAX_BODY_BYTES);
  });

  it('every valid conversation has a reportable room — the largest reference fits the room address bound', () => {
    const kind = 'k'.repeat(CHAT_CONVERSATION_KIND_MAX_LENGTH);
    const id = 'i'.repeat(CHAT_CONVERSATION_ID_MAX_LENGTH);
    expect(ChatConversationRefSchema.safeParse({ kind, id }).success).toBe(true);
    const targetDo = `ttt:prod:channel:${kind}:${id}`;
    expect(
      ChatParkedDeliveryReportSchema.safeParse({ ...largestValidReport, targetDo }).success,
    ).toBe(true);
  });

  it('refuses a report for a room kind that keeps no outbox, and any extra field', () => {
    expect(
      ChatParkedDeliveryReportSchema.safeParse({ ...largestValidReport, roomKind: 'worker' })
        .success,
    ).toBe(false);
    expect(
      ChatParkedDeliveryReportSchema.safeParse({ ...largestValidReport, text: 'hi' }).success,
    ).toBe(false);
  });

  it('refuses a report with no room or no row to replay', () => {
    expect(
      ChatParkedDeliveryReportSchema.safeParse({ ...largestValidReport, targetDo: '' }).success,
    ).toBe(false);
    expect(
      ChatParkedDeliveryReportSchema.safeParse({ ...largestValidReport, eventId: '' }).success,
    ).toBe(false);
  });
});

describe('a parked-delivery replay', () => {
  it('names the room and the parked row', () => {
    expect(
      ChatParkedDeliveryReplayRequestSchema.parse({ targetDo: 'room', eventId: 'e1' }),
    ).toEqual({ targetDo: 'room', eventId: 'e1' });
    expect(ChatParkedDeliveryReplayRequestSchema.safeParse({ targetDo: 'room' }).success).toBe(
      false,
    );
  });

  it('is answered requeued, or not-parked when the room holds no such parked row', () => {
    expect(CHAT_PARKED_DELIVERY_REPLAY_OUTCOMES).toEqual(['requeued', 'not-parked']);
    expect(ChatParkedDeliveryReplayResultSchema.safeParse({ outcome: 'delivered' }).success).toBe(
      false,
    );
  });
});

describe('a server-written message keeps the accounts it names beside its text', () => {
  it('carries the sender, the text, and the referenced account ids', () => {
    const payload = { senderId: CHAT_SYSTEM_SENDER_ID, text: 'x', referencedUids: ['u1'] };
    expect(ChatServerMessagePayloadSchema.parse(payload)).toEqual(payload);
  });

  it('bounds the referenced ids and the text, and refuses any other field', () => {
    const base = { senderId: CHAT_SYSTEM_SENDER_ID, text: 'x' };
    const tooMany = Array.from({ length: CHAT_MESSAGE_REFERENCED_UIDS_MAX + 1 }, (_, i) => `u${i}`);
    expect(
      ChatServerMessagePayloadSchema.safeParse({ ...base, referencedUids: tooMany }).success,
    ).toBe(false);
    expect(
      ChatServerMessagePayloadSchema.safeParse({ ...base, referencedUids: [''] }).success,
    ).toBe(false);
    expect(
      ChatServerMessagePayloadSchema.safeParse({
        ...base,
        text: 'x'.repeat(CHAT_MESSAGE_TEXT_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(ChatServerMessagePayloadSchema.safeParse({ ...base, replyTo: 'm1' }).success).toBe(
      false,
    );
  });
});

describe('a signed chat internal call is signed for one direction', () => {
  it('has exactly two directions: the server to a room, and a room to the server', () => {
    expect(CHAT_INTERNAL_CALL_DIRECTIONS).toEqual(['to-room', 'to-server']);
  });

  it('gives each direction and environment its own audience under the chat audience', () => {
    expect(chatInternalAudience('to-room', 'prod')).toBe('ttt-chat:to-room:prod');
    expect(chatInternalAudience('to-server', 'prod')).toBe('ttt-chat:to-server:prod');
    expect(chatInternalAudience('to-room', 'dev').startsWith(`${CHAT_GRANT_AUDIENCE}:`)).toBe(true);
  });

  it('never gives two directions or environments the same audience, so one signature verifies in one direction only', () => {
    const audiences = CHAT_INTERNAL_CALL_DIRECTIONS.flatMap((direction) =>
      ['prod', 'dev', 'test', 'to-room', 'to-server:prod'].map((env) =>
        chatInternalAudience(direction, env),
      ),
    );
    expect(new Set(audiences).size).toBe(audiences.length);
  });

  it('refuses an empty environment', () => {
    expect(() => chatInternalAudience('to-room', '')).toThrow(RangeError);
  });
});

describe('a parked-delivery report travels as signed raw bytes', () => {
  it('signs the parked row it names: the operation id is the report eventId', () => {
    expect(chatParkedDeliveryReportOperationId({ eventId: 'evt-7' })).toBe('evt-7');
  });

  it('is sent as an opaque byte body, so the receiver parses nothing before verifying it', () => {
    expect(CHAT_PARKED_DELIVERY_REPORT_CONTENT_TYPE).toBe('application/octet-stream');
  });
});

describe('a sync event the server applies to a room', () => {
  const event = {
    eventId: 'evt-1',
    targetDo: 'ttt:prod:channel:guildChannel:wp1/c1',
    kind: 'channelAuth' as const,
    version: 3,
    payload: { uid: 'u1', channelAuthState: 'authorized' },
    tombstone: false,
    payloadHash: 'a'.repeat(64),
  };

  it('carries the event id, the room, the fact kind, its version and hash, and the fact', () => {
    expect(ChatSyncApplyRequestSchema.parse(event)).toEqual(event);
  });

  it('syncs only the three authoritative facts a room applies', () => {
    expect(CHAT_SYNC_APPLY_KINDS).toEqual(['channelAuth', 'accountAccess', 'config']);
    expect(ChatSyncApplyRequestSchema.safeParse({ ...event, kind: 'serverMessage' }).success).toBe(
      false,
    );
  });

  it('refuses a coerced or missing field rather than guessing it', () => {
    const parse = (over: Record<string, unknown>) =>
      ChatSyncApplyRequestSchema.safeParse({ ...event, ...over }).success;
    expect(parse({ version: '3' })).toBe(false);
    expect(parse({ version: -1 })).toBe(false);
    expect(parse({ version: 1.5 })).toBe(false);
    expect(parse({ tombstone: 'false' })).toBe(false);
    expect(parse({ payload: null })).toBe(false);
    expect(parse({ payload: ['x'] })).toBe(false);
    expect(parse({ payloadHash: '' })).toBe(false);
    expect(parse({ payloadHash: undefined })).toBe(false);
    expect(parse({ eventId: '' })).toBe(false);
    expect(parse({ targetDo: '' })).toBe(false);
  });

  it('refuses any other field', () => {
    expect(ChatSyncApplyRequestSchema.safeParse({ ...event, status: 'pending' }).success).toBe(
      false,
    );
  });

  it('accepts the largest room address and operation id', () => {
    const largest = {
      ...event,
      eventId: 'e'.repeat(CHAT_INTERNAL_OPERATION_ID_MAX_LENGTH),
      targetDo: 't'.repeat(CHAT_ROOM_TARGET_MAX_LENGTH),
      payloadHash: 'h'.repeat(CHAT_DIGEST_MAX_LENGTH),
    };
    expect(ChatSyncApplyRequestSchema.safeParse(largest).success).toBe(true);
    expect(
      ChatSyncApplyRequestSchema.safeParse({ ...largest, eventId: `${largest.eventId}e` }).success,
    ).toBe(false);
    expect(
      ChatSyncApplyRequestSchema.safeParse({ ...largest, payloadHash: `${largest.payloadHash}h` })
        .success,
    ).toBe(false);
  });
});

describe('a server-originated message the server appends to a room', () => {
  const command = {
    commandId: 'cmd-1',
    kind: 'systemMsg' as const,
    threadRef: 'ttt:prod:channel:guildInvite:inv1',
    payload: { senderId: CHAT_SYSTEM_SENDER_ID, text: 'agreed', referencedUids: ['u1'] },
  };

  it('carries the command id, its kind, the room, and the server message', () => {
    expect(ChatOutboxAppendRequestSchema.parse(command)).toEqual(command);
  });

  it('is either a member message the server sends or a system line', () => {
    expect(CHAT_OUTBOX_COMMAND_KINDS).toEqual(['userMsg', 'systemMsg']);
    expect(
      ChatOutboxAppendRequestSchema.safeParse({ ...command, kind: 'attachment' }).success,
    ).toBe(false);
  });

  it('refuses a message the server-message contract refuses, a missing room, and any other field', () => {
    const parse = (over: Record<string, unknown>) =>
      ChatOutboxAppendRequestSchema.safeParse({ ...command, ...over }).success;
    expect(parse({ payload: { senderId: 'system', text: 'x', replyTo: 'm1' } })).toBe(false);
    expect(parse({ payload: { text: 'x' } })).toBe(false);
    expect(parse({ threadRef: '' })).toBe(false);
    expect(parse({ commandId: '' })).toBe(false);
    expect(parse({ payloadVersion: 1 })).toBe(false);
  });
});

describe('the word-list snapshot the server publishes', () => {
  const snapshot = { wordListVersion: 4, words: ['a', 'b'], hash: 'f'.repeat(64) };

  it('carries the version, the words, and their hash', () => {
    expect(ChatWordListSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it('refuses a malformed version, a missing hash, a non-string word, and any other field', () => {
    const parse = (over: Record<string, unknown>) =>
      ChatWordListSnapshotSchema.safeParse({ ...snapshot, ...over }).success;
    expect(parse({ wordListVersion: -1 })).toBe(false);
    expect(parse({ wordListVersion: '4' })).toBe(false);
    expect(parse({ hash: '' })).toBe(false);
    expect(parse({ words: ['a', 1] })).toBe(false);
    expect(parse({ publishedAt: 1 })).toBe(false);
  });
});
