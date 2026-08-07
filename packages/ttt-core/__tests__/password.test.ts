// The TTT password contract, exercised through the PUBLIC package surface (the root
// barrel) rather than the source file, so a broken re-export fails here.
import { describe, it, expect } from 'vitest';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, validateTttPassword } from '../src/index';
import * as constantsBarrel from '../src/constants/index';
import * as utilsBarrel from '../src/utils/index';

const TOO_SHORT = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
const TOO_LONG = `Password must be no more than ${PASSWORD_MAX_LENGTH} characters.`;

/** A surrogate pair: one code point, two UTF-16 code units. */
const EMOJI = '\u{1F600}';

describe('password policy constants', () => {
  it('exposes the settled 7/64 policy from the root barrel', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(7);
    expect(PASSWORD_MAX_LENGTH).toBe(64);
  });

  it('re-exports the same identities through the constants and utils barrels', () => {
    expect(constantsBarrel.PASSWORD_MIN_LENGTH).toBe(PASSWORD_MIN_LENGTH);
    expect(constantsBarrel.PASSWORD_MAX_LENGTH).toBe(PASSWORD_MAX_LENGTH);
    expect(utilsBarrel.validateTttPassword).toBe(validateTttPassword);
  });
});

describe('validateTttPassword — length boundaries', () => {
  it('accepts exactly the minimum (inclusive)', () => {
    expect(validateTttPassword('a'.repeat(PASSWORD_MIN_LENGTH))).toBeNull();
  });

  it('accepts exactly the maximum (inclusive)', () => {
    expect(validateTttPassword('a'.repeat(PASSWORD_MAX_LENGTH))).toBeNull();
  });

  it('rejects one unit below the minimum with the exact copy', () => {
    expect(validateTttPassword('a'.repeat(PASSWORD_MIN_LENGTH - 1))).toBe(
      'Password must be at least 7 characters.'
    );
  });

  it('rejects one unit above the maximum with the exact copy', () => {
    expect(validateTttPassword('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe(
      'Password must be no more than 64 characters.'
    );
  });

  it('rejects an empty password as too short', () => {
    expect(validateTttPassword('')).toBe(TOO_SHORT);
  });

  it('derives both messages from the canonical constants', () => {
    expect(validateTttPassword('a')).toBe(TOO_SHORT);
    expect(validateTttPassword('a'.repeat(PASSWORD_MAX_LENGTH * 2))).toBe(TOO_LONG);
  });
});

describe('validateTttPassword — no trimming, normalizing, or mutation', () => {
  it('counts leading spaces toward the minimum', () => {
    // 6 spaces + 1 letter: valid as written, too short if trimmed.
    expect(validateTttPassword('      a')).toBeNull();
  });

  it('counts trailing spaces toward the minimum', () => {
    expect(validateTttPassword('abc    ')).toBeNull();
  });

  it('accepts a password made only of spaces at the minimum length', () => {
    expect(validateTttPassword(' '.repeat(PASSWORD_MIN_LENGTH))).toBeNull();
  });

  it('rejects a space-only password below the minimum length', () => {
    expect(validateTttPassword(' '.repeat(PASSWORD_MIN_LENGTH - 1))).toBe(TOO_SHORT);
  });

  it('does not Unicode-normalize before counting', () => {
    // 'a' + combining acute + 'bcdef' is 7 code units; NFC would collapse it to 6.
    const decomposed = 'ábcdef';
    expect(decomposed.length).toBe(7);
    expect(decomposed.normalize('NFC').length).toBe(6);
    expect(validateTttPassword(decomposed)).toBeNull();
  });
});

describe('validateTttPassword — no composition rules', () => {
  it('accepts an all-lowercase alphabetic password', () => {
    expect(validateTttPassword('abcdefg')).toBeNull();
  });

  it('accepts ordinary non-ASCII Unicode', () => {
    // 10 units, and a 7-unit Cyrillic password sitting exactly on the minimum.
    expect(validateTttPassword('contraseña')).toBeNull();
    expect(validateTttPassword('пароль!')).toBeNull();
  });

  it('accepts a passphrase with interior spaces', () => {
    expect(validateTttPassword('correct horse battery staple')).toBeNull();
  });
});

describe('validateTttPassword — UTF-16 code units, not code points', () => {
  it('counts a surrogate-pair emoji as two units at the minimum boundary', () => {
    const fourEmoji = EMOJI.repeat(4);
    expect(fourEmoji.length).toBe(8);
    expect([...fourEmoji].length).toBe(4); // code-point counting would reject this
    expect(validateTttPassword(fourEmoji)).toBeNull();

    // 3 emoji + 1 ASCII = 7 units / 4 code points — still valid.
    expect(validateTttPassword(`${EMOJI.repeat(3)}a`)).toBeNull();

    // 3 emoji = 6 units: one unit short.
    expect(validateTttPassword(EMOJI.repeat(3))).toBe(TOO_SHORT);
  });

  it('counts surrogate pairs as two units at the maximum boundary', () => {
    const thirtyTwoEmoji = EMOJI.repeat(32);
    expect(thirtyTwoEmoji.length).toBe(PASSWORD_MAX_LENGTH);
    expect(validateTttPassword(thirtyTwoEmoji)).toBeNull();

    // 65 units — one over, despite being only 33 code points.
    expect(validateTttPassword(`${thirtyTwoEmoji}a`)).toBe(TOO_LONG);
    expect(validateTttPassword(EMOJI.repeat(33))).toBe(TOO_LONG);
  });
});
