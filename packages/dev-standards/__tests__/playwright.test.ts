import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlaywrightConfig } from '../src/node/playwright.js';

const projects = [{ name: 'setup', testMatch: /setup\.ts/ }];

const expected = (ci: boolean) => ({
  testDir: './e2e',
  fullyParallel: true,
  timeout: 90_000,
  forbidOnly: true,
  retries: ci ? 2 : 1,
  workers: ci ? 2 : 4,
  reporter: [['html', { open: 'never' }], ['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    reducedMotion: 'reduce',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects,
});

const appValues = {
  baseURL: 'http://127.0.0.1:3000',
  globalSetup: './e2e/global-setup.ts',
  projects,
};

describe('createPlaywrightConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds the local config with forbidOnly, one retry, and four workers off CI', () => {
    vi.stubEnv('CI', '');
    expect(createPlaywrightConfig(appValues)).toEqual(expected(false));
  });

  it('builds the CI config with forbidOnly, two retries, and two workers', () => {
    vi.stubEnv('CI', 'true');
    expect(createPlaywrightConfig(appValues)).toEqual(expected(true));
  });

  it('fails a .only and asks every browser for reduced motion, on CI and off it', () => {
    for (const ci of ['', 'true']) {
      vi.stubEnv('CI', ci);
      const config = createPlaywrightConfig(appValues);
      expect(config.forbidOnly).toBe(true);
      expect(config.use?.reducedMotion).toBe('reduce');
    }
  });

  it('sets no globalSetup key when the app has none', () => {
    const config = createPlaywrightConfig({ baseURL: appValues.baseURL, projects });
    expect('globalSetup' in config).toBe(false);
  });
});
