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

/**
 * Structured report of a rate-limiter degradation. Passed to the injected
 * `onDegraded` hook so the consuming app can decide the alerting posture
 * (e.g. Sentry `captureMessage` in prod, a warn line in the emulator) WITHOUT
 * this generic package importing a monitoring provider directly.
 *
 * - `reason: 'unavailable'` — a limiter could not be built (Redis is null:
 *   missing credentials or the disable hook). Fired at most once per factory
 *   instance, on the FIRST `checkRateLimit` call, so an unconfigured prod deploy
 *   pages within minutes of traffic instead of silently allowing everything.
 * - `reason: 'limit-error'` — `limiter.limit()` rejected at runtime (e.g. an
 *   Upstash outage). The call fails OPEN (`allowed: true`) after reporting.
 */
export interface RateLimiterDegradation {
  reason: 'unavailable' | 'limit-error';
  /** The limiter prefix in play, when known. */
  prefix?: string;
  /** The underlying error for `reason: 'limit-error'`. */
  error?: unknown;
}

export interface RateLimiterFactoryOptions {
  /** Returns the Redis client or null when disabled. */
  getRedis: () => Redis | null;
  /** When true, includes Upstash analytics. Default true. */
  analytics?: boolean;
  /**
   * Optional degradation hook. The consuming app injects its own alerting
   * (Sentry capture in prod, warn in local/emulator) — this package stays
   * provider-agnostic. `unavailable` fires at most once per factory instance;
   * `limit-error` fires per failed `limit()` call. The hook must never throw
   * (it is invoked inside the fail-open path).
   */
  onDegraded?: (info: RateLimiterDegradation) => void;
}

/**
 * Create a memoized Ratelimit factory. Limiters are cached by their `prefix`
 * so repeated calls with the same config return the same instance.
 */
export function createRateLimiterFactory(options: RateLimiterFactoryOptions) {
  const limiters = new Map<string, Ratelimit>();
  const analytics = options.analytics ?? true;
  // Fire the `unavailable` degradation at most once per factory instance.
  let reportedUnavailable = false;

  function report(info: RateLimiterDegradation): void {
    try {
      options.onDegraded?.(info);
    } catch {
      // The alerting hook must never break the fail-open path.
    }
  }

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
   * when Redis is unavailable OR the limit isn't exceeded.
   *
   * FAIL-OPEN POSTURE (decided 2026-07-03): both failure modes degrade to
   * "allow, but observed" rather than blocking every write. When the limiter is
   * unavailable (Redis null — missing credentials / disabled), the first call
   * reports `unavailable` so an unconfigured prod deploy is loud. When a built
   * limiter's `limit()` rejects (Upstash outage), the error is reported and the
   * call still allows — an outage must not take down every rate-limited callable.
   */
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
      // Runtime Redis error (e.g. Upstash outage). Fail OPEN, but report.
      report({ reason: 'limit-error', prefix: config.prefix, error });
      return { allowed: true };
    }
  }

  return { getRateLimiter, checkRateLimit };
}
