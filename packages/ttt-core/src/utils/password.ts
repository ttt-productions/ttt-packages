import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '../constants/business-user.js';

// Not named `validatePassword`: Firebase's SDK exports one that reads the mutable hosted policy.
export function validateTttPassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be no more than ${PASSWORD_MAX_LENGTH} characters.`;
  }
  return null;
}
