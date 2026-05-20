import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";

export interface RateLimitConfig {
  /** Unique prefix for this limiter (e.g. "ratelimit:upload"). */
  prefix: string;
  /** Max requests allowed in the window. */
  maxRequests: number;
  /** Window duration (e.g. "1 h", "10 m", "1 d"). */
  window: string;
}

export interface RateLimiterFactoryOptions {
  /** Returns the Redis client or null when disabled. */
  getRedis: () => Redis | null;
  /** When true, includes Upstash analytics. Default true. */
  analytics?: boolean;
}

/**
 * Create a memoized Ratelimit factory. Limiters are cached by their `prefix`
 * so repeated calls with the same config return the same instance.
 */
export function createRateLimiterFactory(options: RateLimiterFactoryOptions) {
  const limiters = new Map<string, Ratelimit>();
  const analytics = options.analytics ?? true;

  function getRateLimiter(config: RateLimitConfig): Ratelimit | null {
    const redis = options.getRedis();
    if (!redis) return null;

    const existing = limiters.get(config.prefix);
    if (existing) return existing;

    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.maxRequests, config.window as Parameters<typeof Ratelimit.slidingWindow>[1]),
      analytics,
      prefix: config.prefix,
    });
    limiters.set(config.prefix, limiter);
    return limiter;
  }

  /**
   * Check rate limit for a key (e.g. userId). Returns `{ allowed: true }`
   * when Redis is disabled OR the limit isn't exceeded.
   */
  async function checkRateLimit(
    key: string,
    config: RateLimitConfig,
  ): Promise<{ allowed: true } | { allowed: false; reset: number }> {
    const limiter = getRateLimiter(config);
    if (!limiter) return { allowed: true };
    const { success, reset } = await limiter.limit(key);
    if (!success) return { allowed: false, reset };
    return { allowed: true };
  }

  return { getRateLimiter, checkRateLimit };
}
