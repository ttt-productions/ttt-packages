import {
  formatPhone,
  readPhoneText,
  type DeclaredPhoneFormat,
  type PhoneTextIssue,
} from '@ttt-productions/input-format-core';

export type PhoneFieldDeclaration = DeclaredPhoneFormat & { readonly label: string };

const PHONE_EXAMPLE_DIGITS = '8145550123';

export function phoneFieldRefusal(
  declaration: PhoneFieldDeclaration,
  issue: PhoneTextIssue,
): string {
  const { label } = declaration;
  if (issue === 'missing') return `${label} cannot be empty.`;
  return `${label} must be a 10-digit US number with its area code, like ${formatPhone(PHONE_EXAMPLE_DIGITS, declaration)}.`;
}

export type PhoneFieldResult =
  | { readonly ok: true; readonly digits: string | null }
  | { readonly ok: false; readonly reason: string };

export function checkPhoneField(
  declaration: PhoneFieldDeclaration,
  text: string,
): PhoneFieldResult {
  const result = readPhoneText(text, declaration);
  if (result.ok) return { ok: true, digits: result.digits };
  return { ok: false, reason: phoneFieldRefusal(declaration, result.issue) };
}
