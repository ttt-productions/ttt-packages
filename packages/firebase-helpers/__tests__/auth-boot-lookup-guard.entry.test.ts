import { describe, it, expect } from 'vitest';
import {
  BOOT_LOOKUP_URL_FRAGMENT,
  BOOT_REQUEST_ATTEMPTS,
  BOOT_REQUEST_RETRY_DELAYS_MS,
  BOOT_TOKEN_REFRESH_URL_FRAGMENT,
} from '../src/client/auth-boot-lookup-guard.js';
import * as client from '../src/client/index.js';

describe('the Auth boot guard constants', () => {
  it('are exported from the client entry', () => {
    expect(client.BOOT_LOOKUP_URL_FRAGMENT).toBe(BOOT_LOOKUP_URL_FRAGMENT);
    expect(client.BOOT_TOKEN_REFRESH_URL_FRAGMENT).toBe(BOOT_TOKEN_REFRESH_URL_FRAGMENT);
    expect(client.BOOT_REQUEST_RETRY_DELAYS_MS).toBe(BOOT_REQUEST_RETRY_DELAYS_MS);
    expect(client.BOOT_REQUEST_ATTEMPTS).toBe(BOOT_REQUEST_ATTEMPTS);
  });

  it('count one attempt plus one per retry delay', () => {
    expect(BOOT_REQUEST_ATTEMPTS).toBe(BOOT_REQUEST_RETRY_DELAYS_MS.length + 1);
  });
});
