import { describe, it, expect } from 'vitest';
import { CHAT_MODERATION_ACTIONS } from '@ttt-productions/chat-schemas';
import { ChatAdminActionCommandSchema } from '../src/doc-schemas/chat-sync.js';
import { AdminModerateChatMessageInputSchema } from '../src/schemas/chat.js';

describe('chat moderation actions', () => {
  it('an admin moderation request offers exactly the actions the chat contract carries', () => {
    expect(AdminModerateChatMessageInputSchema.shape.action.options).toEqual([
      ...CHAT_MODERATION_ACTIONS,
    ]);
  });

  it('a stored moderation command records exactly the actions the chat contract carries', () => {
    expect(ChatAdminActionCommandSchema.shape.action.options).toEqual([...CHAT_MODERATION_ACTIONS]);
  });
});
