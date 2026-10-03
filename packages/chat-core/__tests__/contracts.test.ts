import { describe, it, expect, expectTypeOf } from 'vitest';
import * as chatCore from '../src/index.js';
import type { ChatNameResolution, ChatNameResolver, ChatThreadV1 } from '../src/index.js';

describe('chat-core contracts', () => {
  it('declares no message-length bound — the one send bound belongs to the wire contract', () => {
    expect('MAX_CHAT_MESSAGE_LENGTH' in chatCore).toBe(false);
  });

  it('a thread carries no access list — access is the app\'s decision, never a stored list', () => {
    expectTypeOf<ChatThreadV1>().not.toHaveProperty('allowedUserIds');
  });

  it('a name resolver answers with a resolution that can say pending, unavailable, or failed — never a bare name or null', () => {
    expectTypeOf<ReturnType<ChatNameResolver>>().toEqualTypeOf<ChatNameResolution>();
    expectTypeOf<ChatNameResolution['status']>().toEqualTypeOf<'resolved' | 'pending' | 'unavailable' | 'failed'>();
    expectTypeOf<Extract<ChatNameResolution, { status: 'failed' }>['retry']>().toEqualTypeOf<() => void>();
    expectTypeOf<Extract<ChatNameResolution, { status: 'resolved' }>['name']>().toEqualTypeOf<string>();
  });
});
