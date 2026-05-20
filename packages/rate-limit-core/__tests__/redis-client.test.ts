import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(),
}));

import { createRedisClientFactory } from '../src/redis-client.js';
import { Redis } from '@upstash/redis';

const MockedRedis = vi.mocked(Redis);

describe('createRedisClientFactory', () => {
  beforeEach(() => {
    MockedRedis.mockClear();
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
    const mockInstance = {};
    MockedRedis.mockImplementation(() => mockInstance as unknown as Redis);

    const factory = createRedisClientFactory({
      credentials: { url: () => url, token: () => token },
    });

    const first = factory.get();
    const second = factory.get();
    expect(first).toBe(mockInstance);
    expect(second).toBe(mockInstance);
    expect(MockedRedis).toHaveBeenCalledTimes(1);
    expect(MockedRedis).toHaveBeenCalledWith({ url, token });
  });

  it('__reset clears cache and allows re-resolution', () => {
    const url = 'https://redis-url';
    const token = 'my-token';
    const instance1 = { id: 1 };
    const instance2 = { id: 2 };
    MockedRedis
      .mockImplementationOnce(() => instance1 as unknown as Redis)
      .mockImplementationOnce(() => instance2 as unknown as Redis);

    const factory = createRedisClientFactory({
      credentials: { url: () => url, token: () => token },
    });

    expect(factory.get()).toBe(instance1);
    factory.__reset();
    expect(factory.get()).toBe(instance2);
  });
});
