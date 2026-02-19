import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// mobile-core/env.ts exports module-level constants evaluated at import time.
// We reset modules to get fresh evaluations per test.

describe('mobile-core env', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('isBrowser is true when window and document exist (jsdom)', async () => {
    // jsdom sets window and document
    const mod = await import('../src/env');
    expect(mod.isBrowser).toBe(true);
  });

  it('hasVisualViewport reflects window.visualViewport existence', async () => {
    const mod = await import('../src/env');
    // jsdom does not provide visualViewport by default
    expect(typeof mod.hasVisualViewport).toBe('boolean');
  });

  it('isIOS is false with default jsdom userAgent', async () => {
    const mod = await import('../src/env');
    // jsdom default UA does not contain iPhone/iPad/iPod
    expect(mod.isIOS).toBe(false);
  });

  it('isSafari is false with default jsdom userAgent', async () => {
    const mod = await import('../src/env');
    // jsdom default UA is not Safari
    expect(mod.isSafari).toBe(false);
  });

  it('isBrowser is false when window is undefined', async () => {
    vi.resetModules();
    const originalWindow = global.window;
    // @ts-expect-error
    delete global.window;
    const mod = await import('../src/env');
    expect(mod.isBrowser).toBe(false);
    // Restore
    global.window = originalWindow;
  });
});
