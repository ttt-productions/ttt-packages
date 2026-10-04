import { describe, it, expect } from 'vitest';
import {
  INPUT_FORMATS,
  checkInputFormat,
  defineInputFormat,
  isInputFormat,
  type InputFormat,
  type InputFormatSpec,
  type DeclaredInputFormat,
} from '../src/index.js';

const spec = (format: InputFormat, min = 0, max = 100, keepAsTyped?: true): InputFormatSpec =>
  keepAsTyped ? { format, min, max, keepAsTyped } : { format, min, max };

const accepts = (format: InputFormat, text: string) => checkInputFormat(text, spec(format)).ok;

describe('the named input formats', () => {
  it('are exactly the five formats every text field declares from', () => {
    expect([...INPUT_FORMATS].sort()).toEqual(
      ['englishLettersOnly', 'englishNormal', 'englishNormalNoSpaces', 'none', 'singleLine'],
    );
  });

  it('isInputFormat recognises a named format and nothing else', () => {
    for (const format of INPUT_FORMATS) expect(isInputFormat(format)).toBe(true);
    expect(isInputFormat('title')).toBe(false);
    expect(isInputFormat('toString')).toBe(false);
    expect(isInputFormat(undefined)).toBe(false);
  });
});

describe('englishNormal — English letters, digits, and the space, on one line', () => {
  it('accepts letters, digits, and spaces between words', () => {
    expect(accepts('englishNormal', 'Dragon Lands 2')).toBe(true);
    expect(accepts('englishNormal', 'ALL CAPS and lower 0123456789')).toBe(true);
  });

  it('refuses punctuation, accents, other scripts, and path characters', () => {
    for (const text of ["Dragon's Lair", 'Sci-Fi', 'Café', 'Señor', '漢字', 'a/b', 'a.b', 'a_b', 'Hello!', 'a,b']) {
      expect(checkInputFormat(text, spec('englishNormal'))).toEqual({ ok: false, value: text, issue: 'invalidCharacters' });
    }
  });

  it('refuses a line break or a tab between words', () => {
    expect(accepts('englishNormal', 'two\nlines')).toBe(false);
    expect(accepts('englishNormal', 'tab\tbetween')).toBe(false);
  });

  it('keeps runs of internal spaces as typed', () => {
    expect(checkInputFormat('Dragon  lands', spec('englishNormal'))).toEqual({ ok: true, value: 'Dragon  lands' });
  });
});

describe('englishNormalNoSpaces — English letters and digits only', () => {
  it('accepts letters and digits', () => {
    expect(accepts('englishNormalNoSpaces', 'Artisan42')).toBe(true);
  });

  it('refuses an internal space or any other character', () => {
    for (const text of ['two words', 'under_score', 'dash-ed', 'dot.ted', 'émile']) {
      expect(accepts('englishNormalNoSpaces', text)).toBe(false);
    }
  });

  it('holds a username to 3–20 characters', () => {
    const username = spec('englishNormalNoSpaces', 3, 20);
    expect(checkInputFormat('ab', username)).toMatchObject({ ok: false, issue: 'tooShort' });
    expect(checkInputFormat('abc', username)).toEqual({ ok: true, value: 'abc' });
    expect(checkInputFormat('a'.repeat(20), username).ok).toBe(true);
    expect(checkInputFormat('a'.repeat(21), username)).toMatchObject({ ok: false, issue: 'tooLong' });
  });
});

describe('englishLettersOnly — English letters only', () => {
  it('accepts letters in either case', () => {
    expect(accepts('englishLettersOnly', 'Wishlist')).toBe(true);
  });

  it('refuses digits, spaces, and every other character', () => {
    for (const text of ['abc1', 'two words', 'hyphen-ated', 'ñ']) expect(accepts('englishLettersOnly', text)).toBe(false);
  });
});

describe('singleLine — any character except a line break', () => {
  it('accepts punctuation, accents, other scripts, emoji, and tabs', () => {
    expect(accepts('singleLine', "Hello, world! Café — 漢字 😀\tend")).toBe(true);
  });

  it('refuses every line break: LF, CR, the line separator, and the paragraph separator', () => {
    const lineSeparator = String.fromCharCode(0x2028);
    const paragraphSeparator = String.fromCharCode(0x2029);
    for (const text of ['a\nb', 'a\rb', `a${lineSeparator}b`, `a${paragraphSeparator}b`]) {
      expect(checkInputFormat(text, spec('singleLine'))).toMatchObject({ ok: false, issue: 'invalidCharacters' });
    }
  });
});

describe('none — any character, line breaks included', () => {
  it('accepts multi-line text with any characters', () => {
    expect(checkInputFormat('Chapter one\n\nIt was a dark night… 😀', spec('none'))).toEqual({
      ok: true,
      value: 'Chapter one\n\nIt was a dark night… 😀',
    });
  });
});

describe('the check trims, then judges min, then max, then the characters', () => {
  it('returns the trimmed text as the value the field keeps', () => {
    expect(checkInputFormat('  Dragonlands \n', spec('englishNormal', 1))).toEqual({ ok: true, value: 'Dragonlands' });
  });

  it('refuses whitespace-only text when min is 1', () => {
    expect(checkInputFormat(' \t\n ', spec('none', 1))).toEqual({ ok: false, value: '', issue: 'tooShort' });
  });

  it('accepts empty or whitespace-only text as an empty value when min is 0', () => {
    expect(checkInputFormat('', spec('englishNormal', 0))).toEqual({ ok: true, value: '' });
    expect(checkInputFormat('   ', spec('none', 0))).toEqual({ ok: true, value: '' });
  });

  it('judges min on the trimmed length', () => {
    const tenOrMore = spec('none', 10, 2000);
    expect(checkInputFormat('   short   ', tenOrMore)).toMatchObject({ ok: false, issue: 'tooShort' });
    expect(checkInputFormat('  ten chars!  ', tenOrMore)).toEqual({ ok: true, value: 'ten chars!' });
  });

  it('judges max on the trimmed value, so surrounding spaces never count', () => {
    const title = spec('englishNormal', 1, 5);
    expect(checkInputFormat('  abcde  ', title)).toEqual({ ok: true, value: 'abcde' });
    expect(checkInputFormat('abcdef', title)).toMatchObject({ ok: false, issue: 'tooLong' });
  });

  it('counts length in UTF-16 code units, the unit zod and maxLength count', () => {
    expect(checkInputFormat('😀', spec('none', 0, 1))).toMatchObject({ ok: false, issue: 'tooLong' });
    expect(checkInputFormat('😀', spec('none', 0, 2))).toEqual({ ok: true, value: '😀' });
  });

  it('reports a text that is both too long and badly formed as too long', () => {
    expect(checkInputFormat("it's far too long", spec('englishNormal', 1, 5))).toMatchObject({ ok: false, issue: 'tooLong' });
  });

  it('reports a text that is both too short and badly formed as too short', () => {
    expect(checkInputFormat('!', spec('englishNormal', 3, 20))).toMatchObject({ ok: false, issue: 'tooShort' });
  });
});

describe('a declaration that keeps its text as typed', () => {
  const legal = spec('none', 1, 10, true);

  it('keeps the surrounding whitespace in the value', () => {
    expect(checkInputFormat(' Section ', legal)).toEqual({ ok: true, value: ' Section ' });
  });

  it('still refuses whitespace-only text when min is 1', () => {
    expect(checkInputFormat('    ', legal)).toEqual({ ok: false, value: '    ', issue: 'tooShort' });
  });

  it('judges max on the text as typed, the value it keeps', () => {
    expect(checkInputFormat('  12345678  ', legal)).toMatchObject({ ok: false, issue: 'tooLong' });
  });

  it('judges the characters of the text as typed', () => {
    expect(checkInputFormat('heading\n', spec('singleLine', 1, 10, true))).toMatchObject({ ok: false, issue: 'invalidCharacters' });
  });
});

describe('defineInputFormat', () => {
  it('returns the declaration, frozen, with its literal values kept', () => {
    const workTitle = defineInputFormat({ format: 'englishNormal', min: 1, max: 150 });
    expect(workTitle).toEqual({ format: 'englishNormal', min: 1, max: 150 });
    expect(Object.isFrozen(workTitle)).toBe(true);
    const max: 150 = workTitle.max;
    expect(max).toBe(150);
  });

  it('refuses an unknown format', () => {
    expect(() => defineInputFormat({ format: 'title' as InputFormat, min: 1, max: 10 })).toThrow(TypeError);
  });

  it('refuses a min that is negative or not a whole number', () => {
    expect(() => defineInputFormat({ format: 'none', min: -1, max: 10 })).toThrow(RangeError);
    expect(() => defineInputFormat({ format: 'none', min: 1.5, max: 10 })).toThrow(RangeError);
  });

  it('refuses a max below 1, below the min, or not a whole number', () => {
    expect(() => defineInputFormat({ format: 'none', min: 0, max: 0 })).toThrow(RangeError);
    expect(() => defineInputFormat({ format: 'none', min: 5, max: 4 })).toThrow(RangeError);
    expect(() => defineInputFormat({ format: 'none', min: 0, max: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });

  it('is the only way to make a declared input format', () => {
    const declared: DeclaredInputFormat = defineInputFormat({ format: 'none', min: 0, max: 10 });
    // @ts-expect-error an inline literal is not a declared input format
    const literal: DeclaredInputFormat = { format: 'none', min: 0, max: 10 };
    expect(declared).toEqual(literal);
  });

  it('accepts a min equal to the max', () => {
    expect(defineInputFormat({ format: 'singleLine', min: 6, max: 6 })).toEqual({ format: 'singleLine', min: 6, max: 6 });
  });
});
