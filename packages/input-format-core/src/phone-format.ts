const PHONE_FORMAT_RULES = {
  us: {
    digitCount: 10,
    leadingDigitAt: { areaCode: 0, exchange: 3 },
    groups: [3, 3, 4],
    maxTextLength: 20,
  },
} as const satisfies Record<
  string,
  {
    digitCount: number;
    leadingDigitAt: Readonly<Record<'areaCode' | 'exchange', number>>;
    groups: readonly number[];
    maxTextLength: number;
  }
>;

export type PhoneFormat = keyof typeof PHONE_FORMAT_RULES;

export const PHONE_FORMATS = Object.freeze(Object.keys(PHONE_FORMAT_RULES) as PhoneFormat[]);

export function isPhoneFormat(value: unknown): value is PhoneFormat {
  return (
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(PHONE_FORMAT_RULES, value)
  );
}

export interface PhoneFormatSpec {
  readonly format: PhoneFormat;
  readonly required: boolean;
}

declare const DECLARED_PHONE: unique symbol;

export type DeclaredPhoneFormat<S extends PhoneFormatSpec = PhoneFormatSpec> = Readonly<S> & {
  readonly [DECLARED_PHONE]: true;
};

export function definePhoneFormat<const S extends PhoneFormatSpec>(
  spec: S,
): DeclaredPhoneFormat<S> {
  if (!isPhoneFormat(spec.format)) {
    throw new TypeError(`Unknown phone format: ${String(spec.format)}`);
  }
  return Object.freeze({ ...spec }) as DeclaredPhoneFormat<S>;
}

export function phoneTextMaxLength(spec: PhoneFormatSpec): number {
  return PHONE_FORMAT_RULES[spec.format].maxTextLength;
}

export type PhoneDigitsIssue =
  'invalidCharacters' | 'tooFewDigits' | 'tooManyDigits' | 'invalidAreaCode' | 'invalidExchange';

export type PhoneTextIssue = 'missing' | 'tooLong' | PhoneDigitsIssue;

export type PhoneTextResult =
  | { readonly ok: true; readonly digits: string | null }
  | { readonly ok: false; readonly issue: PhoneTextIssue };

export type PhoneDigitsResult =
  { readonly ok: true } | { readonly ok: false; readonly issue: PhoneDigitsIssue };

const PHONE_TEXT = /^[0-9 ().-]*$/;
const NOT_A_DIGIT = /\D/g;
const ONLY_DIGITS = /^[0-9]*$/;

export function checkPhoneDigits(digits: string, spec: PhoneFormatSpec): PhoneDigitsResult {
  const rule = PHONE_FORMAT_RULES[spec.format];
  if (!ONLY_DIGITS.test(digits)) return { ok: false, issue: 'invalidCharacters' };
  if (digits.length < rule.digitCount) return { ok: false, issue: 'tooFewDigits' };
  if (digits.length > rule.digitCount) return { ok: false, issue: 'tooManyDigits' };
  if (digits[rule.leadingDigitAt.areaCode] < '2') return { ok: false, issue: 'invalidAreaCode' };
  if (digits[rule.leadingDigitAt.exchange] < '2') return { ok: false, issue: 'invalidExchange' };
  return { ok: true };
}

export function readPhoneText(text: string, spec: PhoneFormatSpec): PhoneTextResult {
  const trimmed = text.trim();
  if (trimmed.length === 0)
    return spec.required ? { ok: false, issue: 'missing' } : { ok: true, digits: null };
  if (trimmed.length > phoneTextMaxLength(spec)) return { ok: false, issue: 'tooLong' };
  if (!PHONE_TEXT.test(trimmed)) return { ok: false, issue: 'invalidCharacters' };
  const digits = trimmed.replace(NOT_A_DIGIT, '');
  const checked = checkPhoneDigits(digits, spec);
  return checked.ok ? { ok: true, digits } : checked;
}

export function formatPhone(digits: string, spec: PhoneFormatSpec): string {
  if (!checkPhoneDigits(digits, spec).ok) return digits;
  const parts: string[] = [];
  let start = 0;
  for (const length of PHONE_FORMAT_RULES[spec.format].groups) {
    parts.push(digits.slice(start, start + length));
    start += length;
  }
  return parts.join('-');
}
