// The ONE owner of what a person is told when a text field refuses their text, and the one check that
// pairs input-format-core's verdict with those words. `textFieldSchema` and
// `validateHallContentTextFields` both read it, so a refusal is worded the same at every boundary.

import {
  checkInputFormat,
  type DeclaredInputFormat,
  type InputFormat,
  type InputFormatIssue,
} from '@ttt-productions/input-format-core';

/** A TTT text field's declaration: its format, min, and max, and the label its refusals name it by. */
export type TextFieldDeclaration = DeclaredInputFormat & { readonly label: string };

/** What a field of each format says when its text holds a character the format does not allow. */
const CHARACTER_RULE_BY_FORMAT = {
  englishNormal: 'can only use letters, numbers, and spaces.',
  englishNormalNoSpaces: 'can only use letters and numbers.',
  englishLettersOnly: 'can only use letters.',
  singleLine: 'must be on one line.',
  none: null,
} as const satisfies Record<InputFormat, string | null>;

/** The sentence for one refusal of `text` by `declaration`. */
export function textFieldRefusal(declaration: TextFieldDeclaration, issue: InputFormatIssue, text: string): string {
  const { label } = declaration;
  if (issue === 'tooShort') {
    return text.trim().length === 0
      ? `${label} cannot be empty.`
      : `${label} must be at least ${declaration.min} characters.`;
  }
  if (issue === 'tooLong') return `${label} can be at most ${declaration.max} characters.`;
  const rule = CHARACTER_RULE_BY_FORMAT[declaration.format];
  // A `none` field allows every character, so the check never refuses one for its characters.
  if (rule === null) throw new Error(`The ${declaration.format} format refuses no character.`);
  return `${label} ${rule}`;
}

export type TextFieldResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly reason: string };

/** Checks `text` against its field's declaration: the value to keep, or the sentence that refuses it. */
export function checkTextField(declaration: TextFieldDeclaration, text: string): TextFieldResult {
  const result = checkInputFormat(text, declaration);
  if (result.ok) return { ok: true, value: result.value };
  return { ok: false, reason: textFieldRefusal(declaration, result.issue, text) };
}
