const CENTS_PER_DOLLAR = 100;
const CENT_DIGITS = 2;

export interface MoneyFormatSpec {
  readonly minCents: number;
  readonly maxCents: number;
}

declare const DECLARED_MONEY: unique symbol;

export type DeclaredMoneyFormat<S extends MoneyFormatSpec = MoneyFormatSpec> = Readonly<S> & {
  readonly [DECLARED_MONEY]: true;
};

export function defineMoneyFormat<const S extends MoneyFormatSpec>(
  spec: S,
): DeclaredMoneyFormat<S> {
  if (!Number.isSafeInteger(spec.minCents) || spec.minCents < 0) {
    throw new RangeError(
      `A money format's minCents must be a whole number of at least 0; got ${spec.minCents}`,
    );
  }
  if (!Number.isSafeInteger(spec.maxCents) || spec.maxCents < 1 || spec.maxCents < spec.minCents) {
    throw new RangeError(
      `A money format's maxCents must be a whole number of at least 1 and at least its minCents (${spec.minCents}); got ${spec.maxCents}`,
    );
  }
  return Object.freeze({ ...spec }) as DeclaredMoneyFormat<S>;
}

export interface MoneyDigitLimits {
  readonly dollarDigits: number;
  readonly centDigits: number;
}

export function moneyDigitLimits(spec: MoneyFormatSpec): MoneyDigitLimits {
  return {
    dollarDigits: String(Math.floor(spec.maxCents / CENTS_PER_DOLLAR)).length,
    centDigits: CENT_DIGITS,
  };
}

export type MoneyTextIssue = 'invalidCharacters' | 'tooManyDollarDigits' | 'tooManyCentDigits';

export type MoneyTextResult =
  | { readonly ok: true; readonly cents: number | null }
  | { readonly ok: false; readonly issue: MoneyTextIssue };

const MONEY_TEXT = /^(\d*)(?:\.(\d*))?$/;

export function readMoneyText(text: string, spec: MoneyFormatSpec): MoneyTextResult {
  const bare = text.trim().replace(/^\$/, '').replace(/,/g, '');
  const match = MONEY_TEXT.exec(bare);
  if (match === null) return { ok: false, issue: 'invalidCharacters' };
  const dollars = (match[1] ?? '').replace(/^0+(?=\d)/, '');
  const cents = match[2] ?? '';
  const limits = moneyDigitLimits(spec);
  if (dollars.length > limits.dollarDigits) return { ok: false, issue: 'tooManyDollarDigits' };
  if (cents.length > limits.centDigits) return { ok: false, issue: 'tooManyCentDigits' };
  if (dollars.length === 0 && cents.length === 0) return { ok: true, cents: null };
  return {
    ok: true,
    cents: Number(dollars || '0') * CENTS_PER_DOLLAR + Number(cents.padEnd(CENT_DIGITS, '0')),
  };
}

export type MoneyAmountIssue = 'notWholeCents' | 'tooSmall' | 'tooLarge';

export type MoneyAmountResult =
  { readonly ok: true } | { readonly ok: false; readonly issue: MoneyAmountIssue };

export function checkMoneyCents(cents: number, spec: MoneyFormatSpec): MoneyAmountResult {
  if (!Number.isSafeInteger(cents)) return { ok: false, issue: 'notWholeCents' };
  if (cents < spec.minCents) return { ok: false, issue: 'tooSmall' };
  if (cents > spec.maxCents) return { ok: false, issue: 'tooLarge' };
  return { ok: true };
}

export function moneyTextFromCents(cents: number): string {
  const dollars = Math.trunc(cents / CENTS_PER_DOLLAR);
  const rest = String(Math.abs(cents % CENTS_PER_DOLLAR)).padStart(CENT_DIGITS, '0');
  return `${dollars}.${rest}`;
}

export type MoneyDisplayStyle = 'cents' | 'wholeDollars' | 'compact';

const MONEY_DISPLAY = {
  cents: new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: CENT_DIGITS,
    maximumFractionDigits: CENT_DIGITS,
  }),
  wholeDollars: new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }),
  compact: new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }),
} as const satisfies Record<MoneyDisplayStyle, Intl.NumberFormat>;

export function formatMoney(cents: number, style: MoneyDisplayStyle = 'cents'): string {
  return MONEY_DISPLAY[style].format(cents / CENTS_PER_DOLLAR);
}
