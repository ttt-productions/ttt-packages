// The ONE date-of-birth validation and age-bracket derivation. Every surface that takes a date of
// birth — the registration age step, the teen-to-adult upgrade, the artisan onboarding — derives
// from it, server-side for the decision and client-side only for the form's feedback. Pure: no
// storage, no logging (a raw date of birth is never logged or persisted by this code).

import type { AgeBracket } from '../doc-schemas/safety/age.js';
import type { DateOfBirth } from '../schemas/users.js';
import {
  AGE_ADULT_FLOOR_YEARS,
  AGE_TEEN_FLOOR_YEARS,
  DATE_OF_BIRTH_MIN_YEAR,
} from '../constants/business-user.js';

/**
 * The outcome of a date of birth: an eligible bracket, too young for any account, or not a real
 * date of birth. `under13` and `invalid` are kept apart here; a surface that must not reveal an
 * under-13 answer maps both to the same refusal itself.
 */
export type AgeBracketDerivation =
  | { readonly kind: 'eligible'; readonly bracket: AgeBracket }
  | { readonly kind: 'under13' }
  | { readonly kind: 'invalid' };

/** Whole years from `dob` to `asOf`, on the UTC calendar (a birthday counts from its own day). */
export function ageInWholeYears(dob: DateOfBirth, asOf: Date): number {
  let years = asOf.getUTCFullYear() - dob.year;
  const monthDiff = asOf.getUTCMonth() + 1 - dob.month;
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getUTCDate() < dob.day)) years -= 1;
  return years;
}

/**
 * Derive the bracket a date of birth gives at `asOf`. `invalid` for a part that is not a whole
 * number, a month or day out of range, an impossible calendar date (Feb 30), a year before
 * `DATE_OF_BIRTH_MIN_YEAR`, or a date after `asOf`; `under13` below `AGE_TEEN_FLOOR_YEARS`; `teen`
 * below `AGE_ADULT_FLOOR_YEARS`; `adult` from there.
 */
export function deriveAgeBracket(dob: DateOfBirth, asOf: Date): AgeBracketDerivation {
  const { year, month, day } = dob;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return { kind: 'invalid' };
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < DATE_OF_BIRTH_MIN_YEAR) return { kind: 'invalid' };
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getTime() > asOf.getTime()
  ) {
    return { kind: 'invalid' };
  }
  const years = ageInWholeYears(dob, asOf);
  if (years < AGE_TEEN_FLOOR_YEARS) return { kind: 'under13' };
  if (years < AGE_ADULT_FLOOR_YEARS) return { kind: 'eligible', bracket: 'teen' };
  return { kind: 'eligible', bracket: 'adult' };
}
