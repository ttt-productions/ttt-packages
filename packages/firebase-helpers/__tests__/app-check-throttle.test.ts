import { describe, it, expect } from 'vitest';
import {
  APP_CHECK_NEVER_SENT_CODES,
  APP_CHECK_THROTTLE_CODES,
  isAppCheckConnectionFailure,
  isAppCheckThrottleError,
  isAppCheckTokenFailure,
} from '../src/utils/app-check-throttle.js';

describe('isAppCheckThrottleError', () => {
  it('accepts every code in the canonical set', () => {
    for (const code of APP_CHECK_THROTTLE_CODES) {
      expect(isAppCheckThrottleError(Object.assign(new Error(code), { code }))).toBe(true);
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

describe('the App Check codes that mean a callable was never sent', () => {
  it("names the token fetch's network failure as the connection kind, and nothing else", () => {
    expect(APP_CHECK_NEVER_SENT_CODES.connectionFailed).toEqual(['appCheck/fetch-network-error']);
    expect(isAppCheckConnectionFailure({ code: 'appCheck/fetch-network-error' })).toBe(true);
    expect(isAppCheckTokenFailure({ code: 'appCheck/fetch-network-error' })).toBe(false);
  });

  it('counts every throttle code as a token failure, so a throttle is never sent either', () => {
    for (const code of APP_CHECK_THROTTLE_CODES) {
      expect(isAppCheckTokenFailure({ code })).toBe(true);
      expect(isAppCheckConnectionFailure({ code })).toBe(false);
    }
  });

  it('counts every other way the token fetch fails as a token failure', () => {
    for (const code of [
      'appCheck/fetch-status-error',
      'appCheck/fetch-parse-error',
      'appCheck/recaptcha-error',
      'appCheck/use-before-activation',
    ]) {
      expect(isAppCheckTokenFailure(Object.assign(new Error(code), { code }))).toBe(true);
      expect(isAppCheckConnectionFailure({ code })).toBe(false);
    }
  });

  it('puts no code in both kinds', () => {
    const connection = new Set<string>(APP_CHECK_NEVER_SENT_CODES.connectionFailed);
    for (const code of APP_CHECK_NEVER_SENT_CODES.tokenFailed) {
      expect(connection.has(code)).toBe(false);
    }
  });

  it('leaves out codes that are not a token fetch failing, and every callable code', () => {
    for (const code of [
      'appCheck/already-initialized',
      'appCheck/storage-open',
      'appCheck/storage-get',
      'appCheck/storage-set',
      'functions/unavailable',
      'functions/unauthenticated',
      'functions/deadline-exceeded',
      'fetch-network-error',
    ]) {
      expect(isAppCheckConnectionFailure({ code })).toBe(false);
      expect(isAppCheckTokenFailure({ code })).toBe(false);
    }
  });

  it('rejects non-objects and errors carrying no string code', () => {
    for (const value of [undefined, null, 'appCheck/fetch-network-error', 42, { code: 7 }]) {
      expect(isAppCheckConnectionFailure(value)).toBe(false);
      expect(isAppCheckTokenFailure(value)).toBe(false);
    }
  });
});
