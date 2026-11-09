import { describe, expect, it } from 'vitest';
import {
  defineRegistrationEngineSettings,
  registrationRefusalReason,
} from '../src/registration.js';

describe('the registration engine settings', () => {
  it('are exactly the timeout the product gives, and refuse one that is not whole seconds', () => {
    expect(defineRegistrationEngineSettings({ functionTimeoutSeconds: 30 })).toEqual({
      functionTimeoutSeconds: 30,
    });
    expect(() => defineRegistrationEngineSettings({ functionTimeoutSeconds: 0 })).toThrow(
      TypeError,
    );
    expect(() => defineRegistrationEngineSettings({ functionTimeoutSeconds: 1.5 })).toThrow(
      TypeError,
    );
  });
});

describe('recognizing a registration refusal', () => {
  it('reads the reason from a server or a client error with its matching code', () => {
    const details = { reason: 'email-already-registered' };
    expect(registrationRefusalReason({ code: 'already-exists', details })).toBe(
      'email-already-registered',
    );
    expect(registrationRefusalReason({ code: 'functions/already-exists', details })).toBe(
      'email-already-registered',
    );
    expect(
      registrationRefusalReason({
        code: 'functions/invalid-argument',
        details: { reason: 'password-refused' },
      }),
    ).toBe('password-refused');
  });

  it('refuses a reason under another code, an unknown reason, and an error with no details', () => {
    expect(
      registrationRefusalReason({
        code: 'invalid-argument',
        details: { reason: 'email-already-registered' },
      }),
    ).toBeNull();
    expect(
      registrationRefusalReason({ code: 'already-exists', details: { reason: 'something-else' } }),
    ).toBeNull();
    expect(registrationRefusalReason({ code: 'already-exists' })).toBeNull();
    expect(registrationRefusalReason(null)).toBeNull();
  });
});
