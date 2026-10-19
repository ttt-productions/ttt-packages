// The sending capacity of a support-thread message is a recorded fact on the stored message: the
// backend stamps `sentAs: 'admin'` on a message sent with verified admin authority and nothing on an
// ordinary one. Readers trust only that recorded value — a missing or malformed one is ordinary.

import { describe, it, expect } from 'vitest';
import { ChatMessageV1Schema, isChatMessageSentAsAdmin } from '../src/doc-schemas/messaging.js';

const ordinary = { senderId: 'u_1', text: 'hello', createdAt: 1 };

describe('ChatMessageV1Schema — sending capacity', () => {
  it('stores an admin-authority message with sentAs admin', () => {
    expect(ChatMessageV1Schema.parse({ ...ordinary, sentAs: 'admin' })).toEqual({
      ...ordinary,
      sentAs: 'admin',
    });
  });

  it('stores an ordinary message with no sending capacity at all', () => {
    expect(ChatMessageV1Schema.parse(ordinary)).not.toHaveProperty('sentAs');
  });

  it('refuses any capacity other than admin', () => {
    for (const sentAs of ['user', 'guildmate', 'system', 'Admin', true, 1]) {
      expect(ChatMessageV1Schema.safeParse({ ...ordinary, sentAs }).success).toBe(false);
    }
  });
});

describe('isChatMessageSentAsAdmin', () => {
  it('is true only for the recorded admin capacity', () => {
    expect(isChatMessageSentAsAdmin('admin')).toBe(true);
  });

  it('reads a missing or malformed value as an ordinary message, never a guess', () => {
    for (const value of [undefined, null, '', 'Admin', 'user', true, { sentAs: 'admin' }]) {
      expect(isChatMessageSentAsAdmin(value)).toBe(false);
    }
  });
});
