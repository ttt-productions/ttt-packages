export interface PasswordPolicy {
  readonly minLength: number;
  readonly maxLength: number;
}

export function definePasswordPolicy(values: PasswordPolicy): PasswordPolicy {
  const policy = { minLength: values.minLength, maxLength: values.maxLength };
  if (
    !Number.isInteger(policy.minLength) ||
    policy.minLength < 1 ||
    !Number.isInteger(policy.maxLength) ||
    policy.maxLength < policy.minLength
  ) {
    throw new TypeError(
      `A password policy needs whole lengths with 1 <= minLength <= maxLength (got ${policy.minLength}..${policy.maxLength}).`,
    );
  }
  return Object.freeze(policy);
}

export type PasswordIssue = 'tooShort' | 'tooLong';

export type PasswordCheck =
  { readonly ok: true } | { readonly ok: false; readonly issue: PasswordIssue };

export function checkPassword(password: string, policy: PasswordPolicy): PasswordCheck {
  if (password.length < policy.minLength) return { ok: false, issue: 'tooShort' };
  if (password.length > policy.maxLength) return { ok: false, issue: 'tooLong' };
  return { ok: true };
}

export function passwordIssueMessage(issue: PasswordIssue, policy: PasswordPolicy): string {
  return issue === 'tooShort'
    ? `Password must be at least ${policy.minLength} characters.`
    : `Password must be no more than ${policy.maxLength} characters.`;
}
