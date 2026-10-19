import { describe, it, expect, afterAll, vi } from 'vitest';

// The visual viewport is set before env.ts loads, since the module reads it once at load.
vi.hoisted(() => {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: { width: 320, height: 480 },
  });
});

import { hasVisualViewport } from '../src/env.js';

afterAll(() => {
  delete (window as { visualViewport?: unknown }).visualViewport;
});

describe('mobile-core env with a visual viewport', () => {
  it('hasVisualViewport is true when window.visualViewport is present', () => {
    expect(hasVisualViewport).toBe(true);
  });
});
