import { describe, it, expect, afterEach, vi } from 'vitest';

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

  it('hasVisualViewport is false in jsdom default (no window.visualViewport)', async () => {
    vi.resetModules();
    // Ensure the property is absent for this evaluation
    delete (window as any).visualViewport;
    const mod = await import('../src/env');
    expect(mod.hasVisualViewport).toBe(false);
  });

  it('hasVisualViewport is true when window.visualViewport is present', async () => {
    vi.resetModules();
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: { width: 320, height: 480 } as unknown as VisualViewport,
    });
    const mod = await import('../src/env');
    expect(mod.hasVisualViewport).toBe(true);
    // Cleanup so subsequent tests see jsdom default again
    delete (window as any).visualViewport;
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
