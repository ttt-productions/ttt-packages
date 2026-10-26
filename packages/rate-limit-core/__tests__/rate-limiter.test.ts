import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RatelimitConfig } from '@upstash/ratelimit';

const ratelimit = vi.hoisted(() => {
  const configs: RatelimitConfig[] = [];
  return {
    configs,
    limit: vi.fn<import('@upstash/ratelimit').Ratelimit['limit']>(),
  };
});

vi.mock('@upstash/ratelimit', async (importOriginal) => {
  const { passThroughModule } = await import('../../../test/typed-mock.js');
  type RatelimitModule = typeof import('@upstash/ratelimit');
  const actual = await importOriginal<RatelimitModule>();
  class RecordingRatelimit extends actual.Ratelimit {
    static override slidingWindow = vi.fn(actual.Ratelimit.slidingWindow);
    override limit = ratelimit.limit;
    constructor(config: RatelimitConfig) {
      super(config);
      ratelimit.configs.push(config);
    }
  }
  return passThroughModule<RatelimitModule>(importOriginal, { Ratelimit: RecordingRatelimit });
});

import { createRateLimiterFactory, type RateLimitRedis } from '../src/rate-limiter.js';
import { Ratelimit } from '@upstash/ratelimit';

// The limiter's own calls are stubbed, so the client only has to be the slice it is typed to take.
const redis: RateLimitRedis = { evalsha: vi.fn(), get: vi.fn(), set: vi.fn() };

const mockLimit = ratelimit.limit;
const limitResponse = (
  success: boolean,
  reset: number,
): Awaited<ReturnType<Ratelimit['limit']>> => ({
  success,
  limit: 5,
  remaining: success ? 4 : 0,
  reset,
  pending: Promise.resolve(),
});

describe('createRateLimiterFactory', () => {
  beforeEach(() => {
    mockLimit.mockReset();
    ratelimit.configs.length = 0;
  });

  it('returns { allowed: true } when getRedis returns null (disabled)', async () => {
    const { checkRateLimit } = createRateLimiterFactory({ getRedis: () => null });
    const result = await checkRateLimit('u1', { prefix: 'p', maxRequests: 5, window: '1 m' });
    expect(result).toEqual({ allowed: true });
  });

  it('memoizes limiter by prefix — same config returns same instance', async () => {
    mockLimit.mockResolvedValue(limitResponse(true, 0));
    const { getRateLimiter } = createRateLimiterFactory({ getRedis: () => redis });
    const config = { prefix: 'test:prefix', maxRequests: 10, window: '1 h' };

    const a = getRateLimiter(config);
    const b = getRateLimiter(config);
    expect(a).toBe(b);
    expect(ratelimit.configs).toHaveLength(1);
  });

  it('builds a new limiter when the same prefix arrives with a different max or window', () => {
    const slidingWindow = vi.mocked(Ratelimit.slidingWindow);
    slidingWindow.mockClear();
    const { getRateLimiter } = createRateLimiterFactory({ getRedis: () => redis });

    const original = getRateLimiter({ prefix: 'ratelimit:write', maxRequests: 10, window: '1 m' });
    const tightened = getRateLimiter({ prefix: 'ratelimit:write', maxRequests: 5, window: '1 m' });
    const rewindowed = getRateLimiter({ prefix: 'ratelimit:write', maxRequests: 5, window: '1 h' });

    expect(tightened).not.toBe(original);
    expect(rewindowed).not.toBe(tightened);
    expect(slidingWindow.mock.calls).toEqual([
      [10, '1 m'],
      [5, '1 m'],
      [5, '1 h'],
    ]);
    expect(ratelimit.configs.map((config) => config.prefix)).toEqual([
      'ratelimit:write',
      'ratelimit:write',
      'ratelimit:write',
    ]);
  });

  it('keeps one limiter per prefix: returning to an earlier config after a change builds it again', () => {
    const { getRateLimiter } = createRateLimiterFactory({ getRedis: () => redis });
    const relaxed = { prefix: 'ratelimit:write', maxRequests: 10, window: '1 m' };

    getRateLimiter(relaxed);
    getRateLimiter({ ...relaxed, maxRequests: 5 });
    const current = getRateLimiter(relaxed);

    expect(ratelimit.configs).toHaveLength(3);
    expect(getRateLimiter(relaxed)).toBe(current);
  });

  it('returns { allowed: false, reset } when success=false', async () => {
    const reset = Date.now() + 60_000;
    mockLimit.mockResolvedValueOnce(limitResponse(false, reset));
    const { checkRateLimit } = createRateLimiterFactory({ getRedis: () => redis });
    const result = await checkRateLimit('u1', {
      prefix: 'ratelimit:test',
      maxRequests: 5,
      window: '1 m',
    });
    expect(result).toEqual({ allowed: false, reset });
  });

  it('returns { allowed: true } when success=true', async () => {
    mockLimit.mockResolvedValueOnce(limitResponse(true, 0));
    const { checkRateLimit } = createRateLimiterFactory({ getRedis: () => redis });
    const result = await checkRateLimit('u1', {
      prefix: 'ratelimit:test',
      maxRequests: 5,
      window: '1 m',
    });
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
      expect(onDegraded).toHaveBeenCalledWith({
        reason: 'unavailable',
        prefix: 'ratelimit:upload',
      });
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
      const { checkRateLimit } = createRateLimiterFactory({
        getRedis: () => redis,
        onDegraded,
      });

      const result = await checkRateLimit('u1', {
        prefix: 'ratelimit:test',
        maxRequests: 5,
        window: '1 m',
      });

      expect(result).toEqual({ allowed: true });
      expect(onDegraded).toHaveBeenCalledTimes(1);
      expect(onDegraded).toHaveBeenCalledWith({
        reason: 'limit-error',
        prefix: 'ratelimit:test',
        error: boom,
      });
    });

    it('reports limit-error per failed call (not latched like unavailable)', async () => {
      mockLimit.mockRejectedValue(new Error('down'));
      const onDegraded = vi.fn();
      const { checkRateLimit } = createRateLimiterFactory({
        getRedis: () => redis,
        onDegraded,
      });
      const config = { prefix: 'ratelimit:test', maxRequests: 5, window: '1 m' };

      await checkRateLimit('u1', config);
      await checkRateLimit('u2', config);

      expect(onDegraded).toHaveBeenCalledTimes(2);
    });

    it('a throwing onDegraded hook never breaks the fail-open path', async () => {
      mockLimit.mockRejectedValueOnce(new Error('down'));
      const onDegraded = vi.fn(() => {
        throw new Error('hook blew up');
      });
      const { checkRateLimit } = createRateLimiterFactory({
        getRedis: () => redis,
        onDegraded,
      });

      const result = await checkRateLimit('u1', {
        prefix: 'ratelimit:test',
        maxRequests: 5,
        window: '1 m',
      });
      expect(result).toEqual({ allowed: true });
    });
  });
});
