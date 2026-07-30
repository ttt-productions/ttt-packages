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
  type WireMessageRow,
} from '../../src/realtime/wire.js';
import { HEARTBEAT_MS, TYPING_COALESCE_MS, HISTORY_PAGE_MAX } from '../../src/realtime/shared.js';
import { MODERATION_REDACTED_TEXT, wireRowToMessage, optimisticMessage } from '../../src/realtime/map.js';

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

// Chat has NO reply-authoring affordance on any surface — MessageActions renders only
// Report/Delete and the Composer sends one argument — so reply-to is dead machinery and
// was removed end to end (DJ ruling 2026-07-29). These guard the removal at the two
// seams a regression would come back through: the mapper (a DO that still stores a
// legacy `replyTo` column must not resurrect a UI reply pointer) and the optimistic
// echo. See also channel-client.test.ts for the outbound send frame.
describe('reply-to is absent from the realtime message mapping', () => {
  it('ignores a legacy stringified replyTo column on a DO row', () => {
    const mapped = wireRowToMessage(
      {
        seq: 7,
        senderUid: 'u-a',
        clientMessageId: 'srv-7',
        text: 'hello',
        createdAt: 1007,
        epoch: 1,
        // A pre-removal DO still has the column and broadcasts it.
        replyTo: JSON.stringify({ messageSeq: 3, preview: 'earlier' }),
      } as unknown as WireMessageRow,
      't-1',
    );
    expect(mapped).not.toHaveProperty('replyTo');
    expect(mapped.text).toBe('hello');
  });

  it('builds an optimistic echo with no reply pointer', () => {
    const echo = optimisticMessage({
      clientMessageId: 'c-1',
      threadId: 't-1',
      senderId: 'u-a',
      text: 'hello',
      createdAt: 1000,
    });
    expect(echo).not.toHaveProperty('replyTo');
  });
});
