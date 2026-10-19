import { describe, it, expect } from 'vitest';
import { hasVisualViewport, isBrowser, isIOS, isSafari } from '../src/env.js';

// mobile-core/env.ts exports constants evaluated when the module loads. This file reads them in
// jsdom's default browser; env-visual-viewport.test.ts and env-no-window.test.ts load the module
// under the other environments.

describe('mobile-core env in a default browser', () => {
  it('isBrowser is true when window and document exist (jsdom)', () => {
    expect(isBrowser).toBe(true);
  });

  it('hasVisualViewport is false in jsdom default (no window.visualViewport)', () => {
    expect(hasVisualViewport).toBe(false);
  });

  it('isIOS is false with default jsdom userAgent', () => {
    expect(isIOS).toBe(false);
  });

  it('isSafari is false with default jsdom userAgent', () => {
    expect(isSafari).toBe(false);
  });
});
