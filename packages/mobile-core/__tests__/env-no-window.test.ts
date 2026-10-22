// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { isBrowser, isIOS, isSafari, hasVisualViewport } from '../src/env.js';

describe('mobile-core env with no window', () => {
  it('isBrowser is false when window is undefined', () => {
    expect(isBrowser).toBe(false);
  });

  it('every browser-derived flag is false', () => {
    expect([isIOS, isSafari, hasVisualViewport]).toEqual([false, false, false]);
  });
});
