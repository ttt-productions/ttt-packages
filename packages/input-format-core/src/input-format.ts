const LINE_BREAKS = '\r\n' + String.fromCharCode(0x2028, 0x2029);

const INPUT_FORMAT_RULES = {
  englishNormal: /^[A-Za-z0-9 ]*$/,
  englishNormalNoSpaces: /^[A-Za-z0-9]*$/,
  englishLettersOnly: /^[A-Za-z]*$/,
  singleLine: new RegExp(`^[^${LINE_BREAKS}]*$`),
  none: null,
} as const satisfies Record<string, RegExp | null>;

export type InputFormat = keyof typeof INPUT_FORMAT_RULES;

export const INPUT_FORMATS = Object.freeze(Object.keys(INPUT_FORMAT_RULES) as InputFormat[]);

export function isInputFormat(value: unknown): value is InputFormat {
  return (
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(INPUT_FORMAT_RULES, value)
  );
}

export interface InputFormatSpec {
  readonly format: InputFormat;
  readonly min: number;
  readonly max: number;
  readonly keepAsTyped?: true;
}

declare const DECLARED: unique symbol;

export type DeclaredInputFormat<S extends InputFormatSpec = InputFormatSpec> = Readonly<S> & {
  readonly [DECLARED]: true;
};

export type InputFormatIssue = 'tooShort' | 'tooLong' | 'invalidCharacters';

export type InputFormatResult =
  | { readonly ok: true; readonly value: string; readonly reformatted: boolean }
  | { readonly ok: false; readonly value: string; readonly issue: InputFormatIssue };

export function checkInputFormat(text: string, spec: InputFormatSpec): InputFormatResult {
  const trimmed = text.trim();
  const value = spec.keepAsTyped ? text : trimmed;
  if (trimmed.length < spec.min) return { ok: false, value, issue: 'tooShort' };
  if (value.length > spec.max) return { ok: false, value, issue: 'tooLong' };
  const allowed = INPUT_FORMAT_RULES[spec.format];
  if (allowed !== null && !allowed.test(value))
    return { ok: false, value, issue: 'invalidCharacters' };
  if (spec.keepAsTyped || spec.format === 'none') return { ok: true, value, reformatted: false };
  const kept = value.replace(/\s+/g, ' ');
  return { ok: true, value: kept, reformatted: kept !== trimmed };
}

export function defineInputFormat<const S extends InputFormatSpec>(
  spec: S,
): DeclaredInputFormat<S> {
  if (!isInputFormat(spec.format)) {
    throw new TypeError(`Unknown input format: ${String(spec.format)}`);
  }
  if (!Number.isInteger(spec.min) || spec.min < 0) {
    throw new RangeError(
      `An input format's min must be a whole number of at least 0; got ${spec.min}`,
    );
  }
  if (!Number.isInteger(spec.max) || spec.max < 1 || spec.max < spec.min) {
    throw new RangeError(
      `An input format's max must be a whole number of at least 1 and at least its min (${spec.min}); got ${spec.max}`,
    );
  }
  return Object.freeze({ ...spec }) as DeclaredInputFormat<S>;
}
