import { describe, it, expect, vi } from 'vitest';
import { awaitFirstToken } from '../src/client/app-check-ready.js';

const instantSleep = vi.fn(async () => undefined);

describe('awaitFirstToken', () => {
  it('resolves true on first-attempt success without sleeping', async () => {
    const getToken = vi.fn(async () => ({ token: 't' }));
    const result = await awaitFirstToken({ getToken, sleep: instantSleep });
    expect(result).toBe(true);
    expect(getToken).toHaveBeenCalledTimes(1);
  });

  it('retries through the backoff schedule and succeeds on a later attempt', async () => {
    const sleep = vi.fn(async (_ms: number) => undefined);
    const getToken = vi
      .fn()
      .mockRejectedValueOnce(new Error('403 attestation failed'))
      .mockRejectedValueOnce(new Error('403 attestation failed'))
      .mockResolvedValueOnce({ token: 't' });
    const result = await awaitFirstToken({ getToken, delaysMs: [10, 20, 30], sleep });
    expect(result).toBe(true);
    expect(getToken).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([10, 20]);
  });

  it('fails OPEN after exhausting attempts: returns false and reports the last error once', async () => {
    const onExhausted = vi.fn();
    const finalError = new Error('still throttled');
    const getToken = vi
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(finalError);
    const result = await awaitFirstToken({
      getToken,
      delaysMs: [5],
      sleep: instantSleep,
      onExhausted,
    });
    expect(result).toBe(false);
    expect(getToken).toHaveBeenCalledTimes(2);
    expect(onExhausted).toHaveBeenCalledTimes(1);
    expect(onExhausted).toHaveBeenCalledWith(finalError);
  });
});
