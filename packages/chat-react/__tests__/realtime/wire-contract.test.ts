import { describe, it, expect } from 'vitest';
// The canonical wire contract (source of truth).
import * as contract from '@ttt-productions/chat-schemas';
// The chat-react realtime re-export surface (must stay identical to the contract).
import {
  CHAT_SUBPROTOCOL,
  CHAT_WIRE_VERSION,
  CHAT_CLOSE_CODES,
  CLIENT_FRAME,
  SERVER_FRAME,
} from '../../src/realtime/wire.js';
import { HEARTBEAT_MS, TYPING_COALESCE_MS, HISTORY_PAGE_MAX } from '../../src/realtime/shared.js';
import { MODERATION_REDACTED_TEXT } from '../../src/realtime/map.js';

describe('chat-react realtime re-exports the chat-schemas wire contract', () => {
  it('re-exports the subprotocol + wire version unchanged', () => {
    expect(CHAT_SUBPROTOCOL).toBe(contract.CHAT_SUBPROTOCOL);
    expect(CHAT_WIRE_VERSION).toBe(contract.CHAT_WIRE_VERSION);
    expect(CHAT_SUBPROTOCOL).toBe('ttt.chat.v1');
  });

  it('aliases CLIENT_FRAME/SERVER_FRAME to the contract CLIENT_KINDS/SERVER_KINDS', () => {
    // Same object identity — a plain re-export alias, not a copy.
    expect(CLIENT_FRAME).toBe(contract.CLIENT_KINDS);
    expect(SERVER_FRAME).toBe(contract.SERVER_KINDS);
  });

  it('re-exports the close-code map unchanged', () => {
    expect(CHAT_CLOSE_CODES).toBe(contract.CHAT_CLOSE_CODES);
  });

  it('re-exports the client-agreed limits unchanged', () => {
    expect(HEARTBEAT_MS).toBe(contract.HEARTBEAT_MS);
    expect(TYPING_COALESCE_MS).toBe(contract.TYPING_COALESCE_MS);
    expect(HISTORY_PAGE_MAX).toBe(contract.HISTORY_PAGE_MAX);
  });

  it('re-exports the moderation redacted text unchanged', () => {
    expect(MODERATION_REDACTED_TEXT).toBe(contract.MODERATION_REDACTED_TEXT);
  });
});
