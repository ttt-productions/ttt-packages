import { Redis } from "@upstash/redis";

export interface RedisCredentialsProvider {
  /** Lazy URL resolver — invoked only when Redis is first needed. */
  url: () => string | undefined;
  /** Lazy token resolver — invoked only when Redis is first needed. */
  token: () => string | undefined;
}

export interface RedisClientFactoryOptions {
  credentials: RedisCredentialsProvider;
  /** Optional disable hook (e.g. emulator/local-dev detection). When this returns true on first call, Redis is permanently disabled for this factory instance. */
  disabledWhen?: () => boolean;
  /** Optional logger for "Redis not configured" / "disabled" diagnostics. */
  logger?: {
    info?: (message: string) => void;
    warn?: (message: string) => void;
  };
}

/**
 * Build a lazy, singleton Redis client. The client is constructed on first
 * `get()` and reused thereafter. Returns null when credentials are missing
 * or the disable hook returned true at first access.
 */
export function createRedisClientFactory(options: RedisClientFactoryOptions): {
  get(): Redis | null;
  /** Test-only: reset cached state. Do not call in production. */
  __reset(): void;
} {
  let cached: Redis | null = null;
  let disabled = false;
  let resolved = false;

  function resolve(): Redis | null {
    if (resolved) return cached;
    resolved = true;

    if (options.disabledWhen?.()) {
      options.logger?.info?.("[rate-limit-core] Redis disabled by disabledWhen hook.");
      disabled = true;
      return null;
    }
    const url = options.credentials.url();
    const token = options.credentials.token();
    if (!url || !token) {
      options.logger?.warn?.("[rate-limit-core] Redis credentials not configured.");
      disabled = true;
      return null;
    }
    cached = new Redis({ url, token });
    return cached;
  }

  return {
    get() {
      if (disabled) return null;
      return resolve();
    },
    __reset() {
      cached = null;
      disabled = false;
      resolved = false;
    },
  };
}
