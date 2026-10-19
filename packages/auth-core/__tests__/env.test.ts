import { describe, it, expect, afterEach } from 'vitest';
import { getAppEnvironment, isDevelopment, isProduction } from '../src/env.js';

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_ENV;
});

describe('getAppEnvironment', () => {
  it('returns development by default', async () => {
    delete process.env.NEXT_PUBLIC_APP_ENV;
    expect(getAppEnvironment()).toBe('development');
  });

  it('returns production when env is set to production', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    expect(getAppEnvironment()).toBe('production');
  });

  it('returns development for unknown env value', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'staging';
    expect(getAppEnvironment()).toBe('development');
  });
});

describe('isDevelopment', () => {
  it('returns true in development', async () => {
    delete process.env.NEXT_PUBLIC_APP_ENV;
    expect(isDevelopment()).toBe(true);
  });

  it('returns false in production', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    expect(isDevelopment()).toBe(false);
  });
});

describe('isProduction', () => {
  it('returns false in development', async () => {
    delete process.env.NEXT_PUBLIC_APP_ENV;
    expect(isProduction()).toBe(false);
  });

  it('returns true in production', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    expect(isProduction()).toBe(true);
  });
});
