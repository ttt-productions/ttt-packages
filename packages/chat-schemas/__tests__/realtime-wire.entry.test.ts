import { describe, it, expect } from 'vitest';
import { CHAT_MESSAGE_TEXT_MAX_LENGTH } from '../src/realtime-wire.js';
import * as chatSchemas from '../src/index.js';

describe('the send bounds', () => {
  it('a message text is declared as any characters, never blank, at most the one text bound', () => {
    expect(chatSchemas.CHAT_MESSAGE_TEXT_INPUT).toEqual({ format: 'none', min: 1, max: CHAT_MESSAGE_TEXT_MAX_LENGTH });
  });

  it('a text that passes is sent and stored trimmed, line breaks and every character kept', () => {
    expect(chatSchemas.judgeChatMessageText('  hello\nthere 😀  ')).toEqual({ ok: true, text: 'hello\nthere 😀' });
  });

  it('an empty or whitespace-only text is a blank rejection', () => {
    expect(chatSchemas.judgeChatMessageText('')).toEqual({ ok: false, code: 'blank' });
    expect(chatSchemas.judgeChatMessageText(' \n\t ')).toEqual({ ok: false, code: 'blank' });
  });

  it('a text over the bound is a too-long rejection, and surrounding whitespace never counts toward it', () => {
    const atBound = 'x'.repeat(CHAT_MESSAGE_TEXT_MAX_LENGTH);
    expect(chatSchemas.judgeChatMessageText(atBound)).toEqual({ ok: true, text: atBound });
    expect(chatSchemas.judgeChatMessageText(` ${atBound} `)).toEqual({ ok: true, text: atBound });
    expect(chatSchemas.judgeChatMessageText(`${atBound}x`)).toEqual({ ok: false, code: 'too-long' });
  });
});

describe('the channel socket client frame payloads', () => {
  it('a send carries a parsed id and its text; the length is judged after the parse', () => {
    const longText = 'x'.repeat(chatSchemas.CHAT_MESSAGE_TEXT_MAX_LENGTH + 1);
    expect(chatSchemas.ChatSendPayloadSchema.parse({ clientMessageId: 'm1', text: longText })).toEqual({ clientMessageId: 'm1', text: longText });
    expect(chatSchemas.ChatSendPayloadSchema.safeParse({ clientMessageId: '', text: 'hi' }).success).toBe(false);
    expect(
      chatSchemas.ChatSendPayloadSchema.safeParse({ clientMessageId: 'm'.repeat(chatSchemas.CHAT_CLIENT_MESSAGE_ID_MAX_LENGTH + 1), text: 'hi' }).success,
    ).toBe(false);
    expect(chatSchemas.ChatSendPayloadSchema.safeParse({ clientMessageId: 'm1' }).success).toBe(false);
  });

  it('a send carries no reply pointer or attachment: extra keys never reach the room', () => {
    expect(chatSchemas.ChatSendPayloadSchema.parse({ clientMessageId: 'm1', text: 'hi', replyTo: 'm0', attachment: {} })).toEqual({
      clientMessageId: 'm1',
      text: 'hi',
    });
  });

  it('a read-ack carries a whole non-negative seq and whether the conversation is in focus (unfocused when absent)', () => {
    expect(chatSchemas.ChatReadAckPayloadSchema.parse({ readSeq: 5, focused: true })).toEqual({ readSeq: 5, focused: true });
    expect(chatSchemas.ChatReadAckPayloadSchema.parse({ readSeq: 0 })).toEqual({ readSeq: 0, focused: false });
    for (const readSeq of [-1, 1.5, '5', null]) {
      expect(chatSchemas.ChatReadAckPayloadSchema.safeParse({ readSeq }).success).toBe(false);
    }
    expect(chatSchemas.ChatReadAckPayloadSchema.safeParse({ readSeq: 1, focused: 'yes' }).success).toBe(false);
  });

  it('a history request pages before a positive seq, never past the page cap', () => {
    expect(chatSchemas.ChatHistoryPayloadSchema.parse({})).toEqual({ limit: chatSchemas.HISTORY_PAGE_MAX });
    expect(chatSchemas.ChatHistoryPayloadSchema.parse({ beforeSeq: null, limit: 10 })).toEqual({ beforeSeq: null, limit: 10 });
    expect(chatSchemas.ChatHistoryPayloadSchema.safeParse({ beforeSeq: 0 }).success).toBe(false);
    expect(chatSchemas.ChatHistoryPayloadSchema.safeParse({ beforeSeq: '9' }).success).toBe(false);
    expect(chatSchemas.ChatHistoryPayloadSchema.safeParse({ limit: chatSchemas.HISTORY_PAGE_MAX + 1 }).success).toBe(false);
    expect(chatSchemas.ChatHistoryPayloadSchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it('a resume names the last seq the client holds, or none', () => {
    expect(chatSchemas.ChatResumePayloadSchema.parse({ afterSeq: 0 })).toEqual({ afterSeq: 0 });
    expect(chatSchemas.ChatResumePayloadSchema.parse({})).toEqual({});
    expect(chatSchemas.ChatResumePayloadSchema.safeParse({ afterSeq: -1 }).success).toBe(false);
    expect(chatSchemas.ChatResumePayloadSchema.safeParse({ afterSeq: '3' }).success).toBe(false);
  });
});

describe('message revision kinds', () => {
  it('is the closed set of what a revision does to a message', () => {
    expect(chatSchemas.CHAT_MESSAGE_REVISION_KINDS).toEqual(['delete', 'moderate', 'edit', 'restore']);
    for (const kind of chatSchemas.CHAT_MESSAGE_REVISION_KINDS) {
      expect(chatSchemas.ChatMessageRevisionKindSchema.parse(kind)).toBe(kind);
    }
  });

  it('refuses any other kind', () => {
    for (const kind of ['hide', 'Delete', '', null]) {
      expect(chatSchemas.ChatMessageRevisionKindSchema.safeParse(kind).success).toBe(false);
    }
  });
});
