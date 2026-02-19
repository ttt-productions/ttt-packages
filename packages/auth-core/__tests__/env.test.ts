import { describe, it, expect, afterEach } from 'vitest';

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_ENV;
});

describe('getAppEnvironment', () => {
  it('returns development by default', async () => {
    delete process.env.NEXT_PUBLIC_APP_ENV;
    const { getAppEnvironment } = await import('../src/env');
    expect(getAppEnvironment()).toBe('development');
  });

  it('returns production when env is set to production', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    const { getAppEnvironment } = await import('../src/env');
    expect(getAppEnvironment()).toBe('production');
  });

  it('returns development for unknown env value', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'staging';
    const { getAppEnvironment } = await import('../src/env');
    expect(getAppEnvironment()).toBe('development');
  });
});

describe('isDevelopment', () => {
  it('returns true in development', async () => {
    delete process.env.NEXT_PUBLIC_APP_ENV;
    const { isDevelopment } = await import('../src/env');
    expect(isDevelopment()).toBe(true);
  });

  it('returns false in production', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    const { isDevelopment } = await import('../src/env');
    expect(isDevelopment()).toBe(false);
  });
});

describe('isProduction', () => {
  it('returns false in development', async () => {
    delete process.env.NEXT_PUBLIC_APP_ENV;
    const { isProduction } = await import('../src/env');
    expect(isProduction()).toBe(false);
  });

  it('returns true in production', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    const { isProduction } = await import('../src/env');
    expect(isProduction()).toBe(true);
  });
});
