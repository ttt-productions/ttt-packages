import { describe, it, expect } from 'vitest';
import {
  PHONE_FORMATS,
  checkPhoneDigits,
  definePhoneFormat,
  formatPhone,
  isPhoneFormat,
  phoneTextMaxLength,
  readPhoneText,
  type PhoneFormat,
} from '../src/phone-format.js';

const US_REQUIRED = definePhoneFormat({ format: 'us', required: true });
const US_OPTIONAL = definePhoneFormat({ format: 'us', required: false });

describe('the named phone formats', () => {
  it('are exactly the US format', () => {
    expect([...PHONE_FORMATS]).toEqual(['us']);
  });

  it('isPhoneFormat recognises a named format and nothing else', () => {
    expect(isPhoneFormat('us')).toBe(true);
    expect(isPhoneFormat('eu')).toBe(false);
    expect(isPhoneFormat('toString')).toBe(false);
    expect(isPhoneFormat(undefined)).toBe(false);
  });
});

describe('definePhoneFormat', () => {
  it('returns the declaration frozen with its values', () => {
    expect(US_REQUIRED).toEqual({ format: 'us', required: true });
    expect(Object.isFrozen(US_REQUIRED)).toBe(true);
  });

  it('refuses an unknown format', () => {
    expect(() => definePhoneFormat({ format: 'eu' as PhoneFormat, required: true })).toThrow(
      TypeError,
    );
  });
});

describe('readPhoneText — a typed US number to its 10 stored digits', () => {
  it('reads the number typed bare, with dashes, dots, spaces, or parentheses', () => {
    for (const text of [
      '8148231858',
      '814-823-1858',
      '814.823.1858',
      '814 823 1858',
      '(814) 823-1858',
      '  (814)823-1858 ',
    ]) {
      expect(readPhoneText(text, US_REQUIRED)).toEqual({ ok: true, digits: '8148231858' });
    }
  });

  it('refuses an empty box when the number is required', () => {
    for (const text of ['', '   ']) {
      expect(readPhoneText(text, US_REQUIRED)).toEqual({ ok: false, issue: 'missing' });
    }
  });

  it('reads an empty box as no number when the number is optional', () => {
    expect(readPhoneText('  ', US_OPTIONAL)).toEqual({ ok: true, digits: null });
  });

  it('refuses a number without its area code', () => {
    expect(readPhoneText('555-0100', US_REQUIRED)).toEqual({ ok: false, issue: 'tooFewDigits' });
    expect(readPhoneText('823-1858', US_REQUIRED)).toEqual({ ok: false, issue: 'tooFewDigits' });
  });

  it('refuses a leading 1 country code as one digit too many', () => {
    expect(readPhoneText('18148231858', US_REQUIRED)).toEqual({
      ok: false,
      issue: 'tooManyDigits',
    });
    expect(readPhoneText('1 (814) 823-1858', US_REQUIRED)).toEqual({
      ok: false,
      issue: 'tooManyDigits',
    });
  });

  it('refuses a plus sign, a letter, or any other character', () => {
    for (const text of ['+1 814 823 1858', '814-823-185O', '814/823/1858', '814-823-1858 x2']) {
      expect(readPhoneText(text, US_REQUIRED)).toEqual({ ok: false, issue: 'invalidCharacters' });
    }
  });

  it('refuses an area code starting with 0 or 1', () => {
    for (const text of ['014-823-1858', '114-823-1858']) {
      expect(readPhoneText(text, US_REQUIRED)).toEqual({ ok: false, issue: 'invalidAreaCode' });
    }
  });

  it('refuses an exchange starting with 0 or 1', () => {
    for (const text of ['814-023-1858', '814-123-1858']) {
      expect(readPhoneText(text, US_REQUIRED)).toEqual({ ok: false, issue: 'invalidExchange' });
    }
  });

  it('refuses text longer than the box holds, whatever its digits', () => {
    const padded = `(${' '.repeat(phoneTextMaxLength(US_REQUIRED))}814) 823-1858`;
    expect(readPhoneText(padded, US_REQUIRED)).toEqual({ ok: false, issue: 'tooLong' });
  });

  it('fits every punctuated form of a number in the box', () => {
    expect('( 814 ) 823 - 1858'.length).toBeLessThanOrEqual(phoneTextMaxLength(US_REQUIRED));
  });
});

describe('checkPhoneDigits — a stored or sent value against the format', () => {
  it('accepts 10 digits with a real area code and exchange', () => {
    expect(checkPhoneDigits('8148231858', US_REQUIRED)).toEqual({ ok: true });
    expect(checkPhoneDigits('2002000000', US_REQUIRED)).toEqual({ ok: true });
  });

  it('refuses the punctuated form, which is never stored', () => {
    expect(checkPhoneDigits('814-823-1858', US_REQUIRED)).toEqual({
      ok: false,
      issue: 'invalidCharacters',
    });
  });

  it('refuses too few or too many digits, and a 0 or 1 where a real number cannot have one', () => {
    expect(checkPhoneDigits('5550100', US_REQUIRED)).toEqual({ ok: false, issue: 'tooFewDigits' });
    expect(checkPhoneDigits('18148231858', US_REQUIRED)).toEqual({
      ok: false,
      issue: 'tooManyDigits',
    });
    expect(checkPhoneDigits('0148231858', US_REQUIRED)).toEqual({
      ok: false,
      issue: 'invalidAreaCode',
    });
    expect(checkPhoneDigits('8141231858', US_REQUIRED)).toEqual({
      ok: false,
      issue: 'invalidExchange',
    });
  });
});

describe('formatPhone — stored digits shown to a person', () => {
  it('shows a US number as three groups joined by dashes', () => {
    expect(formatPhone('8148231858', US_REQUIRED)).toBe('814-823-1858');
  });

  it('reads back to the same digits', () => {
    expect(readPhoneText(formatPhone('8148231858', US_REQUIRED), US_REQUIRED)).toEqual({
      ok: true,
      digits: '8148231858',
    });
  });

  it('shows a value that is not a stored number as it is', () => {
    expect(formatPhone('555-0100', US_REQUIRED)).toBe('555-0100');
  });
});
