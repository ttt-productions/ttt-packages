import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLimit = vi.hoisted(() => vi.fn());

vi.mock('@upstash/ratelimit', () => {
  // Function expression, not an arrow: the source does `new Ratelimit(...)` and
  // Vitest 4 mock implementations are only constructible when the impl is.
  const Ratelimit = vi.fn(function () { return { limit: mockLimit }; });
  (Ratelimit as unknown as { slidingWindow: unknown }).slidingWindow = vi.fn().mockReturnValue('sliding-window-algo');
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

  describe('fail-open posture + onDegraded reporting', () => {
    it('reports `unavailable` ONCE on the first checkRateLimit when Redis is null, then stays quiet', async () => {
      const onDegraded = vi.fn();
      const { checkRateLimit } = createRateLimiterFactory({ getRedis: () => null, onDegraded });
      const config = { prefix: 'ratelimit:upload', maxRequests: 5, window: '1 m' };

      const first = await checkRateLimit('u1', config);
      const second = await checkRateLimit('u2', config);

      expect(first).toEqual({ allowed: true });
      expect(second).toEqual({ allowed: true });
      expect(onDegraded).toHaveBeenCalledTimes(1);
      expect(onDegraded).toHaveBeenCalledWith({ reason: 'unavailable', prefix: 'ratelimit:upload' });
    });

    it('does not require an onDegraded hook (unavailable path still fails open)', async () => {
      const { checkRateLimit } = createRateLimiterFactory({ getRedis: () => null });
      const result = await checkRateLimit('u1', { prefix: 'p', maxRequests: 5, window: '1 m' });
      expect(result).toEqual({ allowed: true });
    });

    it('fails OPEN and reports `limit-error` when limiter.limit() rejects', async () => {
      const boom = new Error('upstash outage');
      mockLimit.mockRejectedValueOnce(boom);
      const onDegraded = vi.fn();
      const { checkRateLimit } = createRateLimiterFactory({ getRedis: () => ({} as never), onDegraded });

      const result = await checkRateLimit('u1', { prefix: 'ratelimit:test', maxRequests: 5, window: '1 m' });

      expect(result).toEqual({ allowed: true });
      expect(onDegraded).toHaveBeenCalledTimes(1);
      expect(onDegraded).toHaveBeenCalledWith({ reason: 'limit-error', prefix: 'ratelimit:test', error: boom });
    });

    it('reports limit-error per failed call (not latched like unavailable)', async () => {
      mockLimit.mockRejectedValue(new Error('down'));
      const onDegraded = vi.fn();
      const { checkRateLimit } = createRateLimiterFactory({ getRedis: () => ({} as never), onDegraded });
      const config = { prefix: 'ratelimit:test', maxRequests: 5, window: '1 m' };

      await checkRateLimit('u1', config);
      await checkRateLimit('u2', config);

      expect(onDegraded).toHaveBeenCalledTimes(2);
    });

    it('a throwing onDegraded hook never breaks the fail-open path', async () => {
      mockLimit.mockRejectedValueOnce(new Error('down'));
      const onDegraded = vi.fn(() => { throw new Error('hook blew up'); });
      const { checkRateLimit } = createRateLimiterFactory({ getRedis: () => ({} as never), onDegraded });

      const result = await checkRateLimit('u1', { prefix: 'ratelimit:test', maxRequests: 5, window: '1 m' });
      expect(result).toEqual({ allowed: true });
    });
  });
});
