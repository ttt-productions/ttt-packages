import { Redis } from '@upstash/redis';

export interface RedisCredentialsProvider {
  url: () => string | undefined;
  token: () => string | undefined;
}

export interface RedisClientFactoryOptions {
  credentials: RedisCredentialsProvider;
  disabledWhen?: () => boolean;
  logger?: {
    info?: (message: string) => void;
    warn?: (message: string) => void;
  };
}

export function createRedisClientFactory(options: RedisClientFactoryOptions): {
  get(): Redis | null;
  __reset(): void;
} {
  let cached: Redis | null = null;
  let disabled = false;
  let resolved = false;

  function resolve(): Redis | null {
    if (resolved) return cached;
    resolved = true;

    if (options.disabledWhen?.()) {
      options.logger?.info?.('[rate-limit-core] Redis disabled by disabledWhen hook.');
      disabled = true;
      return null;
    }
    const url = options.credentials.url();
    const token = options.credentials.token();
    if (!url || !token) {
      options.logger?.warn?.('[rate-limit-core] Redis credentials not configured.');
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
