import { describe, it, expect } from 'vitest';
import * as chatSchemas from '../src/index.js';

const { buildChatRoomAddress, parseChatRoomAddress } = chatSchemas;
const prod = { product: 'ttt', env: 'prod' };

describe('a chat room address keeps the exact bytes existing rooms live under', () => {
  it('names a conversation room {product}:{env}:channel:{kind}:{id}', () => {
    expect(buildChatRoomAddress(prod, { kind: 'channel', ref: { kind: 'guildChannel', id: 'wp1/c1' } })).toBe(
      'ttt:prod:channel:guildChannel:wp1/c1',
    );
    expect(buildChatRoomAddress({ product: 'ttt', env: 'test' }, { kind: 'channel', ref: { kind: 'guildInvite', id: 'inv1' } })).toBe(
      'ttt:test:channel:guildInvite:inv1',
    );
  });

  it('names an inbox room {product}:{env}:inbox:{uid}', () => {
    expect(buildChatRoomAddress({ product: 'ttt', env: 'dev' }, { kind: 'inbox', uid: 'u1' })).toBe('ttt:dev:inbox:u1');
  });

  it('takes the product from the app, never a fixed one', () => {
    expect(buildChatRoomAddress({ product: 'acme', env: 'prod' }, { kind: 'inbox', uid: 'u1' })).toBe('acme:prod:inbox:u1');
  });
});

describe('parsing a chat room address', () => {
  it('reads back every room it builds, a conversation id holding ":" and "/" included', () => {
    const rooms = [
      { kind: 'channel' as const, ref: { kind: 'guildChannel', id: 'wp1/c1' } },
      { kind: 'channel' as const, ref: { kind: 'k', id: 'a:b/c::d' } },
      { kind: 'inbox' as const, uid: 'u1' },
    ];
    for (const room of rooms) {
      expect(parseChatRoomAddress(buildChatRoomAddress(prod, room), prod)).toEqual(room);
    }
  });

  it('takes the conversation id as everything after the fourth ":"', () => {
    expect(parseChatRoomAddress('ttt:prod:channel:guildChannel:wp1:c1', prod)).toEqual({
      kind: 'channel',
      ref: { kind: 'guildChannel', id: 'wp1:c1' },
    });
  });

  it('refuses an address of another environment or product, so one never reaches another deployment', () => {
    expect(parseChatRoomAddress('ttt:dev:inbox:u1', prod)).toBeNull();
    expect(parseChatRoomAddress('acme:prod:inbox:u1', prod)).toBeNull();
    expect(parseChatRoomAddress('ttt:dev:channel:guildChannel:wp1/c1', prod)).toBeNull();
  });

  it('refuses an inbox uid that is empty, holds a separator, or is longer than an account id', () => {
    expect(parseChatRoomAddress('ttt:prod:inbox:', prod)).toBeNull();
    expect(parseChatRoomAddress('ttt:prod:inbox:u1:extra', prod)).toBeNull();
    expect(parseChatRoomAddress(`ttt:prod:inbox:${'u'.repeat(chatSchemas.CHAT_ACCOUNT_ID_MAX_LENGTH + 1)}`, prod)).toBeNull();
  });

  it('refuses an unknown room kind, a missing id, and a conversation its schema refuses', () => {
    expect(parseChatRoomAddress('ttt:prod:invite:inv1', prod)).toBeNull();
    expect(parseChatRoomAddress('ttt:prod:channel:guildChannel', prod)).toBeNull();
    expect(parseChatRoomAddress('ttt:prod:channel:guildChannel:', prod)).toBeNull();
    expect(parseChatRoomAddress('ttt:prod:channel:Guild:x', prod)).toBeNull();
    expect(parseChatRoomAddress('ttt:prod:channel:k:a\nb', prod)).toBeNull();
    expect(parseChatRoomAddress('ttt:prod', prod)).toBeNull();
  });

  it('matches nothing under an invalid namespace', () => {
    expect(parseChatRoomAddress(':prod:inbox:u1', { product: '', env: 'prod' })).toBeNull();
  });
});

describe('building a chat room address refuses what would not parse back to the same room', () => {
  it('refuses a namespace with an empty or ":"-holding product or env', () => {
    const room = { kind: 'inbox' as const, uid: 'u1' };
    expect(() => buildChatRoomAddress({ product: '', env: 'prod' }, room)).toThrow(RangeError);
    expect(() => buildChatRoomAddress({ product: 'ttt', env: '' }, room)).toThrow(RangeError);
    expect(() => buildChatRoomAddress({ product: 't:t', env: 'prod' }, room)).toThrow(RangeError);
    expect(() => buildChatRoomAddress({ product: 'ttt', env: 'p:rod' }, room)).toThrow(RangeError);
  });

  it('refuses an inbox uid that is empty, holds ":", or is longer than an account id', () => {
    expect(() => buildChatRoomAddress(prod, { kind: 'inbox', uid: '' })).toThrow(RangeError);
    expect(() => buildChatRoomAddress(prod, { kind: 'inbox', uid: 'a:b' })).toThrow(RangeError);
    expect(() => buildChatRoomAddress(prod, { kind: 'inbox', uid: 'u'.repeat(chatSchemas.CHAT_ACCOUNT_ID_MAX_LENGTH + 1) })).toThrow(
      RangeError,
    );
  });

  it('refuses a conversation reference its schema refuses', () => {
    expect(() => buildChatRoomAddress(prod, { kind: 'channel', ref: { kind: 'a:b', id: 'x' } })).toThrow(RangeError);
    expect(() => buildChatRoomAddress(prod, { kind: 'channel', ref: { kind: 'k', id: '' } })).toThrow(RangeError);
  });

  it('refuses a namespace too long for the room address bound', () => {
    const roomKindAndSeparators = 'channel'.length + 4;
    const fits = { product: 'p', env: 'e'.repeat(chatSchemas.CHAT_ROOM_TARGET_PREFIX_MAX_LENGTH - roomKindAndSeparators - 1) };
    const tooLong = { product: 'p', env: `${fits.env}e` };
    const room = { kind: 'inbox' as const, uid: 'u1' };
    expect(() => buildChatRoomAddress(fits, room)).not.toThrow();
    expect(() => buildChatRoomAddress(tooLong, room)).toThrow(RangeError);
  });

  it('every address it builds is reportable: the largest one fits the room address bound', () => {
    const roomKindAndSeparators = 'channel'.length + 4;
    const widest = { product: 'p', env: 'e'.repeat(chatSchemas.CHAT_ROOM_TARGET_PREFIX_MAX_LENGTH - roomKindAndSeparators - 1) };
    const ref = {
      kind: 'k'.repeat(chatSchemas.CHAT_CONVERSATION_KIND_MAX_LENGTH),
      id: 'i'.repeat(chatSchemas.CHAT_CONVERSATION_ID_MAX_LENGTH),
    };
    const channel = buildChatRoomAddress(widest, { kind: 'channel', ref });
    const inbox = buildChatRoomAddress(widest, { kind: 'inbox', uid: 'u'.repeat(chatSchemas.CHAT_ACCOUNT_ID_MAX_LENGTH) });
    for (const address of [channel, inbox]) {
      expect(address.length).toBeLessThanOrEqual(chatSchemas.CHAT_ROOM_TARGET_MAX_LENGTH);
      expect(chatSchemas.ChatParkedDeliveryReplayRequestSchema.safeParse({ targetDo: address, eventId: 'e1' }).success).toBe(true);
    }
  });
});
