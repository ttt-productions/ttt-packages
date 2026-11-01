import {
  checkInputFormat,
  type DeclaredInputFormat,
  type InputFormat,
  type InputFormatIssue,
} from '@ttt-productions/input-format-core';

export type TextFieldDeclaration = DeclaredInputFormat & { readonly label: string };

const CHARACTER_RULE_BY_FORMAT = {
  englishNormal: 'can only use letters, numbers, and spaces.',
  englishNormalNoSpaces: 'can only use letters and numbers.',
  englishLettersOnly: 'can only use letters.',
  singleLine: 'must be on one line.',
  none: null,
} as const satisfies Record<InputFormat, string | null>;

export function textFieldRefusal(
  declaration: TextFieldDeclaration,
  issue: InputFormatIssue,
  text: string,
): string {
  const { label } = declaration;
  if (issue === 'tooShort') {
    return text.trim().length === 0
      ? `${label} cannot be empty.`
      : `${label} must be at least ${declaration.min} characters.`;
  }
  if (issue === 'tooLong') return `${label} can be at most ${declaration.max} characters.`;
  const rule = CHARACTER_RULE_BY_FORMAT[declaration.format];
  if (rule === null) throw new Error(`The ${declaration.format} format refuses no character.`);
  return `${label} ${rule}`;
}

export function textFieldReformatNotice(declaration: TextFieldDeclaration): string {
  return `${declaration.label} will be saved with one space between words.`;
}

export type TextFieldResult =
  { readonly ok: true; readonly value: string } | { readonly ok: false; readonly reason: string };

export function checkTextField(declaration: TextFieldDeclaration, text: string): TextFieldResult {
  const result = checkInputFormat(text, declaration);
  if (result.ok) return { ok: true, value: result.value };
  return { ok: false, reason: textFieldRefusal(declaration, result.issue, text) };
}
