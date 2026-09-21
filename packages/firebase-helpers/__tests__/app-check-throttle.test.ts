import { describe, it, expect } from 'vitest';
import {
  APP_CHECK_THROTTLE_CODES,
  isAppCheckThrottleError,
} from '../src/utils/app-check-throttle.js';

describe('isAppCheckThrottleError', () => {
  it('accepts every code in the canonical set', () => {
    for (const code of APP_CHECK_THROTTLE_CODES) {
      expect(isAppCheckThrottleError(Object.assign(new Error(code), { code }))).toBe(true);
      // A plain carrier object counts too — consumers classify on `code`.
      expect(isAppCheckThrottleError({ code })).toBe(true);
    }
  });

  it('covers both the window-opening and the window-refused codes', () => {
    expect(isAppCheckThrottleError({ code: 'appCheck/initial-throttle' })).toBe(true);
    expect(isAppCheckThrottleError({ code: 'appCheck/throttled' })).toBe(true);
  });

  it('rejects other App Check codes and callable codes', () => {
    for (const code of [
      'appCheck/fetch-status-error',
      'appCheck/use-before-activation',
      'functions/internal',
      'functions/deadline-exceeded',
      'throttled',
      'initial-throttle',
    ]) {
      expect(isAppCheckThrottleError({ code })).toBe(false);
    }
  });

  it('rejects non-objects and errors carrying no string code', () => {
    expect(isAppCheckThrottleError(undefined)).toBe(false);
    expect(isAppCheckThrottleError(null)).toBe(false);
    expect(isAppCheckThrottleError('appCheck/throttled')).toBe(false);
    expect(isAppCheckThrottleError(42)).toBe(false);
    expect(isAppCheckThrottleError(new Error('appCheck/throttled'))).toBe(false);
    expect(isAppCheckThrottleError({ code: 7 })).toBe(false);
  });
});
