// The password contract is reached through the PUBLIC package entries that own it (the constants
// and utils entries), so a broken forward fails here.
import { describe, it, expect } from 'vitest';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '../src/constants/index.js';
import { validateTttPassword } from '../src/utils/index.js';
import * as businessUser from '../src/constants/business-user.js';
import * as passwordSource from '../src/utils/password.js';

describe('password policy constants', () => {
  it('re-exports the source declarations through the constants and utils entries', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(businessUser.PASSWORD_MIN_LENGTH);
    expect(PASSWORD_MAX_LENGTH).toBe(businessUser.PASSWORD_MAX_LENGTH);
    expect(validateTttPassword).toBe(passwordSource.validateTttPassword);
  });
});
