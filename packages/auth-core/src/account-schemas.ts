import { z } from 'zod';
import { passwordIssueMessage } from './password-policy.js';
import type { PasswordPolicy } from './password-policy.js';

export const ACCOUNT_EMAIL_MAX_LENGTH = 320;

export const accountEmailSchema = z
  .email({ message: 'Please enter a valid email.' })
  .max(ACCOUNT_EMAIL_MAX_LENGTH, { message: 'That email is too long.' });

export function accountPasswordSchema(policy: PasswordPolicy) {
  return z
    .string()
    .min(policy.minLength, { message: passwordIssueMessage('tooShort', policy) })
    .max(policy.maxLength, { message: passwordIssueMessage('tooLong', policy) });
}
