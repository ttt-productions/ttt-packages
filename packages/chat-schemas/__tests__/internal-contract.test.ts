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
