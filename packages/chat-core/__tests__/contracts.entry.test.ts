import { describe, it, expect } from 'vitest';
import * as chatCore from '../src/index.js';

describe('chat-core contracts', () => {
  it('declares no message-length bound — the one send bound belongs to the wire contract', () => {
    expect('MAX_CHAT_MESSAGE_LENGTH' in chatCore).toBe(false);
  });
});
