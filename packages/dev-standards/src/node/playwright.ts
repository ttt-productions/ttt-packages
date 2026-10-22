import type { PlaywrightTestConfig } from '@playwright/test';

export interface PlaywrightOptions {
  baseURL: string;
  globalSetup?: string;
  projects: NonNullable<PlaywrightTestConfig['projects']>;
}

export function createPlaywrightConfig(options: PlaywrightOptions): PlaywrightTestConfig {
  const ci = !!process.env.CI;
  return {
    testDir: './e2e',
    fullyParallel: true,
    // Chained 10–20s web-first assertions under parallel workers on one emulator overrun the 30s
    // default; each assertion keeps its own timeout.
    timeout: 90_000,
    forbidOnly: ci,
    // test:quiet fails the gate on any retry-pass, so a retry is diagnostic only.
    retries: ci ? 2 : 1,
    // Four local workers fit only because the suite runs against a production build.
    workers: ci ? 2 : 4,
    reporter: [['html', { open: 'never' }], ['list']],
    ...(options.globalSetup !== undefined ? { globalSetup: options.globalSetup } : {}),
    use: {
      baseURL: options.baseURL,
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      actionTimeout: 15_000,
      navigationTimeout: 30_000,
    },
    projects: options.projects,
  };
}
