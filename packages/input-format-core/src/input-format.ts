/** CR, LF, the line separator (U+2028), and the paragraph separator (U+2029). */
const LINE_BREAKS = '\r\n' + String.fromCharCode(0x2028, 0x2029);

/**
 * The characters each named format allows, written once. `null` allows every character, line breaks
 * included. A pattern is matched against the whole checked value, so an empty value passes it and
 * emptiness is judged by `min` alone.
 */
const INPUT_FORMAT_RULES = {
  /** English letters, digits, and the space (U+0020); one line. */
  englishNormal: /^[A-Za-z0-9 ]*$/,
  /** English letters and digits only. */
  englishNormalNoSpaces: /^[A-Za-z0-9]*$/,
  /** English letters only. */
  englishLettersOnly: /^[A-Za-z]*$/,
  /** Any character except a line break. */
  singleLine: new RegExp(`^[^${LINE_BREAKS}]*$`),
  /** Any character, line breaks included. */
  none: null,
} as const satisfies Record<string, RegExp | null>;

/** A named input format. */
export type InputFormat = keyof typeof INPUT_FORMAT_RULES;

/** Every named input format. */
export const INPUT_FORMATS = Object.freeze(Object.keys(INPUT_FORMAT_RULES) as InputFormat[]);

export function isInputFormat(value: unknown): value is InputFormat {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(INPUT_FORMAT_RULES, value);
}

/**
 * One text field's declaration: its format, its min, and its max, in UTF-16 code units — the unit a
 * zod `.max()` and an HTML `maxLength` both count.
 *
 * - `min` is judged on the trimmed text: 1 means it cannot be blank, 0 means it is optional.
 * - `max` is judged on the value that is kept.
 * - `keepAsTyped` keeps the text exactly as typed instead of trimming it. Only fields whose words are
 *   kept verbatim may set it; such a field still cannot be blank when its `min` is 1 (ARCH-102).
 */
export interface InputFormatSpec {
  readonly format: InputFormat;
  readonly min: number;
  readonly max: number;
  readonly keepAsTyped?: true;
}

declare const DECLARED: unique symbol;

/**
 * A declaration made by {@link defineInputFormat}. Inputs that render a field take only this, so a
 * bound is never written as an inline literal at the place it is enforced (ENG-005, ARCH-102).
 */
export type DeclaredInputFormat<S extends InputFormatSpec = InputFormatSpec> = Readonly<S> & {
  readonly [DECLARED]: true;
};

/** Why a text failed its declaration, in the order the check judges them. */
export type InputFormatIssue = 'tooShort' | 'tooLong' | 'invalidCharacters';

/**
 * The check's answer. `value` is the text the field keeps — trimmed, unless the declaration keeps it
 * as typed — so a caller sends or stores `value`, never the raw text it checked.
 */
export type InputFormatResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly value: string; readonly issue: InputFormatIssue };

/**
 * The one check every text input and every server bound runs: trim, then min, then max, then the
 * format's characters. The same function runs in the browser and on the server, so both accept
 * exactly the same texts.
 */
export function checkInputFormat(text: string, spec: InputFormatSpec): InputFormatResult {
  const trimmed = text.trim();
  const value = spec.keepAsTyped ? text : trimmed;
  if (trimmed.length < spec.min) return { ok: false, value, issue: 'tooShort' };
  if (value.length > spec.max) return { ok: false, value, issue: 'tooLong' };
  const allowed = INPUT_FORMAT_RULES[spec.format];
  if (allowed !== null && !allowed.test(value)) return { ok: false, value, issue: 'invalidCharacters' };
  return { ok: true, value };
}

/**
 * Declares a field. Throws when the declaration cannot be satisfied — an unknown format, a min that is
 * not a whole number of at least 0, or a max that is not a whole number of at least 1 and at least the
 * min — so a wrong declaration fails where it is written, not at the first text checked against it.
 */
export function defineInputFormat<const S extends InputFormatSpec>(spec: S): DeclaredInputFormat<S> {
  if (!isInputFormat(spec.format)) {
    throw new TypeError(`Unknown input format: ${String(spec.format)}`);
  }
  if (!Number.isInteger(spec.min) || spec.min < 0) {
    throw new RangeError(`An input format's min must be a whole number of at least 0; got ${spec.min}`);
  }
  if (!Number.isInteger(spec.max) || spec.max < 1 || spec.max < spec.min) {
    throw new RangeError(
      `An input format's max must be a whole number of at least 1 and at least its min (${spec.min}); got ${spec.max}`,
    );
  }
  return Object.freeze({ ...spec }) as DeclaredInputFormat<S>;
}
