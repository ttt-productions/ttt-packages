import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLimit = vi.hoisted(() => vi.fn());

vi.mock('@upstash/ratelimit', () => {
  const Ratelimit = vi.fn().mockImplementation(() => ({ limit: mockLimit }));
  (Ratelimit as { slidingWindow: unknown }).slidingWindow = vi.fn().mockReturnValue('sliding-window-algo');
  return { Ratelimit };
});

import { createRateLimiterFactory } from '../src/rate-limiter.js';
import { Ratelimit } from '@upstash/ratelimit';

const MockedRatelimit = vi.mocked(Ratelimit);

describe('createRateLimiterFactory', () => {
  beforeEach(() => {
    mockLimit.mockReset();
    MockedRatelimit.mockClear();
  });

  it('returns { allowed: true } when getRedis returns null (disabled)', async () => {
    const { checkRateLimit } = createRateLimiterFactory({ getRedis: () => null });
    const result = await checkRateLimit('u1', { prefix: 'p', maxRequests: 5, window: '1 m' });
    expect(result).toEqual({ allowed: true });
  });

  it('memoizes limiter by prefix — same config returns same instance', async () => {
    mockLimit.mockResolvedValue({ success: true, reset: 0 });
    const { getRateLimiter } = createRateLimiterFactory({ getRedis: () => ({} as never) });
    const config = { prefix: 'test:prefix', maxRequests: 10, window: '1 h' };

    const a = getRateLimiter(config);
    const b = getRateLimiter(config);
    expect(a).toBe(b);
    expect(MockedRatelimit).toHaveBeenCalledTimes(1);
  });

  it('returns { allowed: false, reset } when success=false', async () => {
    const reset = Date.now() + 60_000;
    mockLimit.mockResolvedValueOnce({ success: false, reset });
    const { checkRateLimit } = createRateLimiterFactory({ getRedis: () => ({} as never) });
    const result = await checkRateLimit('u1', { prefix: 'ratelimit:test', maxRequests: 5, window: '1 m' });
    expect(result).toEqual({ allowed: false, reset });
  });

  it('returns { allowed: true } when success=true', async () => {
    mockLimit.mockResolvedValueOnce({ success: true, reset: 0 });
    const { checkRateLimit } = createRateLimiterFactory({ getRedis: () => ({} as never) });
    const result = await checkRateLimit('u1', { prefix: 'ratelimit:test', maxRequests: 5, window: '1 m' });
    expect(result).toEqual({ allowed: true });
  });
});
