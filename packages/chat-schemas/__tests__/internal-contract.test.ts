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

describe('a signed chat internal call is signed for one direction', () => {
  it('has exactly two directions: the server to a room, and a room to the server', () => {
    expect(chatSchemas.CHAT_INTERNAL_CALL_DIRECTIONS).toEqual(['to-room', 'to-server']);
  });

  it('gives each direction and environment its own audience under the chat audience', () => {
    expect(chatSchemas.chatInternalAudience('to-room', 'prod')).toBe('ttt-chat:to-room:prod');
    expect(chatSchemas.chatInternalAudience('to-server', 'prod')).toBe('ttt-chat:to-server:prod');
    expect(chatSchemas.chatInternalAudience('to-room', 'dev').startsWith(`${chatSchemas.CHAT_GRANT_AUDIENCE}:`)).toBe(true);
  });

  it('never gives two directions or environments the same audience, so one signature verifies in one direction only', () => {
    const audiences = chatSchemas.CHAT_INTERNAL_CALL_DIRECTIONS.flatMap((direction) =>
      ['prod', 'dev', 'test', 'to-room', 'to-server:prod'].map((env) => chatSchemas.chatInternalAudience(direction, env)),
    );
    expect(new Set(audiences).size).toBe(audiences.length);
  });

  it('refuses an empty environment', () => {
    expect(() => chatSchemas.chatInternalAudience('to-room', '')).toThrow(RangeError);
  });
});

describe('a parked-delivery report travels as signed raw bytes', () => {
  it('signs the parked row it names: the operation id is the report eventId', () => {
    expect(chatSchemas.chatParkedDeliveryReportOperationId({ eventId: 'evt-7' })).toBe('evt-7');
  });

  it('is sent as an opaque byte body, so the receiver parses nothing before verifying it', () => {
    expect(chatSchemas.CHAT_PARKED_DELIVERY_REPORT_CONTENT_TYPE).toBe('application/octet-stream');
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
    expect(chatSchemas.ChatSyncApplyRequestSchema.parse(event)).toEqual(event);
  });

  it('syncs only the three authoritative facts a room applies', () => {
    expect(chatSchemas.CHAT_SYNC_APPLY_KINDS).toEqual(['channelAuth', 'accountAccess', 'config']);
    expect(chatSchemas.ChatSyncApplyRequestSchema.safeParse({ ...event, kind: 'serverMessage' }).success).toBe(false);
  });

  it('refuses a coerced or missing field rather than guessing it', () => {
    const parse = (over: Record<string, unknown>) => chatSchemas.ChatSyncApplyRequestSchema.safeParse({ ...event, ...over }).success;
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
    expect(chatSchemas.ChatSyncApplyRequestSchema.safeParse({ ...event, status: 'pending' }).success).toBe(false);
  });

  it('accepts the largest room address and operation id', () => {
    const largest = {
      ...event,
      eventId: 'e'.repeat(chatSchemas.CHAT_INTERNAL_OPERATION_ID_MAX_LENGTH),
      targetDo: 't'.repeat(chatSchemas.CHAT_ROOM_TARGET_MAX_LENGTH),
      payloadHash: 'h'.repeat(chatSchemas.CHAT_DIGEST_MAX_LENGTH),
    };
    expect(chatSchemas.ChatSyncApplyRequestSchema.safeParse(largest).success).toBe(true);
    expect(chatSchemas.ChatSyncApplyRequestSchema.safeParse({ ...largest, eventId: `${largest.eventId}e` }).success).toBe(false);
    expect(chatSchemas.ChatSyncApplyRequestSchema.safeParse({ ...largest, payloadHash: `${largest.payloadHash}h` }).success).toBe(false);
  });
});

describe('a server-originated message the server appends to a room', () => {
  const command = {
    commandId: 'cmd-1',
    kind: 'systemMsg' as const,
    threadRef: 'ttt:prod:channel:guildInvite:inv1',
    payload: { senderId: chatSchemas.CHAT_SYSTEM_SENDER_ID, text: 'agreed', referencedUids: ['u1'] },
  };

  it('carries the command id, its kind, the room, and the server message', () => {
    expect(chatSchemas.ChatOutboxAppendRequestSchema.parse(command)).toEqual(command);
  });

  it('is either a member message the server sends or a system line', () => {
    expect(chatSchemas.CHAT_OUTBOX_COMMAND_KINDS).toEqual(['userMsg', 'systemMsg']);
    expect(chatSchemas.ChatOutboxAppendRequestSchema.safeParse({ ...command, kind: 'attachment' }).success).toBe(false);
  });

  it('refuses a message the server-message contract refuses, a missing room, and any other field', () => {
    const parse = (over: Record<string, unknown>) => chatSchemas.ChatOutboxAppendRequestSchema.safeParse({ ...command, ...over }).success;
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
    expect(chatSchemas.ChatWordListSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it('refuses a malformed version, a missing hash, a non-string word, and any other field', () => {
    const parse = (over: Record<string, unknown>) => chatSchemas.ChatWordListSnapshotSchema.safeParse({ ...snapshot, ...over }).success;
    expect(parse({ wordListVersion: -1 })).toBe(false);
    expect(parse({ wordListVersion: '4' })).toBe(false);
    expect(parse({ hash: '' })).toBe(false);
    expect(parse({ words: ['a', 1] })).toBe(false);
    expect(parse({ publishedAt: 1 })).toBe(false);
  });
});
