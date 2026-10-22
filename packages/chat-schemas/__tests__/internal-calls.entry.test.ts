import { describe, it, expect } from 'vitest';
import * as chatSchemas from '../src/index.js';
import {
  CHAT_ARCHIVE_KEY_MAX_LENGTH,
  CHAT_INTERNAL_CALLS,
  CHAT_INTERNAL_PATHS,
  chatInternalOperationId,
  isChatInternalPath,
  parseChatInternalRequest,
} from '../src/internal-calls.js';

describe('chat internal-call table', () => {
  it('is exported from the package root, so the caller and the chat runtime import one declaration', () => {
    expect(chatSchemas.CHAT_INTERNAL_PATHS).toBe(CHAT_INTERNAL_PATHS);
    expect(chatSchemas.CHAT_INTERNAL_CALLS).toBe(CHAT_INTERNAL_CALLS);
    expect(chatSchemas.isChatInternalPath).toBe(isChatInternalPath);
    expect(chatSchemas.parseChatInternalRequest).toBe(parseChatInternalRequest);
    expect(chatSchemas.chatInternalOperationId).toBe(chatInternalOperationId);
    expect(chatSchemas.CHAT_ARCHIVE_KEY_MAX_LENGTH).toBe(CHAT_ARCHIVE_KEY_MAX_LENGTH);
  });
});
