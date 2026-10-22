import { Ratelimit } from '@upstash/ratelimit';
import type { Redis } from '@upstash/redis';

export interface RateLimitConfig {
  prefix: string;
  maxRequests: number;
  window: string;
}

export interface RateLimiterDegradation {
  reason: 'unavailable' | 'limit-error';
  prefix?: string;
  error?: unknown;
}

export interface RateLimiterFactoryOptions {
  getRedis: () => Redis | null;
  analytics?: boolean;
  onDegraded?: (info: RateLimiterDegradation) => void;
}

export function createRateLimiterFactory(options: RateLimiterFactoryOptions) {
  const limiters = new Map<string, { maxRequests: number; window: string; limiter: Ratelimit }>();
  const analytics = options.analytics ?? true;
  let reportedUnavailable = false;

  function report(info: RateLimiterDegradation): void {
    try {
      options.onDegraded?.(info);
    } catch {}
  }

  function getRateLimiter(config: RateLimitConfig): Ratelimit | null {
    const redis = options.getRedis();
    if (!redis) return null;

    const existing = limiters.get(config.prefix);
    if (
      existing &&
      existing.maxRequests === config.maxRequests &&
      existing.window === config.window
    ) {
      return existing.limiter;
    }

    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        config.maxRequests,
        config.window as Parameters<typeof Ratelimit.slidingWindow>[1],
      ),
      analytics,
      prefix: config.prefix,
    });
    limiters.set(config.prefix, {
      maxRequests: config.maxRequests,
      window: config.window,
      limiter,
    });
    return limiter;
  }

  async function checkRateLimit(
    key: string,
    config: RateLimitConfig,
  ): Promise<{ allowed: true } | { allowed: false; reset: number }> {
    const limiter = getRateLimiter(config);
    if (!limiter) {
      if (!reportedUnavailable) {
        reportedUnavailable = true;
        report({ reason: 'unavailable', prefix: config.prefix });
      }
      return { allowed: true };
    }
    try {
      const { success, reset } = await limiter.limit(key);
      if (!success) return { allowed: false, reset };
      return { allowed: true };
    } catch (error) {
      report({ reason: 'limit-error', prefix: config.prefix, error });
      return { allowed: true };
    }
  }

  return { getRateLimiter, checkRateLimit };
}
