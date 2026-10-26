import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Redis, RedisConfigNodejs, Requester } from '@upstash/redis';

const constructed = vi.hoisted(() => {
  const clients: Array<{ config: RedisConfigNodejs | Requester; client: Redis }> = [];
  return clients;
});

vi.mock('@upstash/redis', async (importOriginal) => {
  const { passThroughModule } = await import('../../../test/typed-mock.js');
  type RedisModule = typeof import('@upstash/redis');
  const actual = await importOriginal<RedisModule>();
  // Constructing a real client opens no connection.
  class RecordingRedis extends actual.Redis {
    constructor(config: RedisConfigNodejs);
    constructor(requester: Requester);
    constructor(config: RedisConfigNodejs | Requester) {
      if ('request' in config) super(config);
      else super(config);
      constructed.push({ config, client: this });
    }
  }
  return passThroughModule<RedisModule>(importOriginal, { Redis: RecordingRedis });
});

import { createRedisClientFactory } from '../src/redis-client.js';

describe('createRedisClientFactory', () => {
  beforeEach(() => {
    constructed.length = 0;
  });

  it('returns null and logs warn when credentials return undefined', () => {
    const warnSpy = vi.fn();
    const factory = createRedisClientFactory({
      credentials: { url: () => undefined, token: () => undefined },
      logger: { warn: warnSpy },
    });
    const result = factory.get();
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not configured'));
  });

  it('returns null and logs info when disabledWhen returns true', () => {
    const infoSpy = vi.fn();
    const factory = createRedisClientFactory({
      credentials: { url: () => 'https://redis-url', token: () => 'token' },
      disabledWhen: () => true,
      logger: { info: infoSpy },
    });
    const result = factory.get();
    expect(result).toBeNull();
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('disabled'));
  });

  it('creates Redis instance with valid credentials and second call returns same instance', () => {
    const url = 'https://redis-url';
    const token = 'my-token';
    const factory = createRedisClientFactory({
      credentials: { url: () => url, token: () => token },
    });

    const first = factory.get();
    const second = factory.get();
    expect(constructed).toHaveLength(1);
    expect(constructed[0].config).toEqual({ url, token });
    expect(first).toBe(constructed[0].client);
    expect(second).toBe(first);
  });

  it('__reset clears cache and allows re-resolution', () => {
    const url = 'https://redis-url';
    const token = 'my-token';
    const factory = createRedisClientFactory({
      credentials: { url: () => url, token: () => token },
    });

    const first = factory.get();
    factory.__reset();
    const second = factory.get();
    expect(constructed).toHaveLength(2);
    expect(constructed[0].client).toBe(first);
    expect(constructed[1].client).toBe(second);
    expect(second).not.toBe(first);
  });
});
