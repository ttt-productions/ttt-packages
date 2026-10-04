import { describe, expect, it } from 'vitest';
import { hashStringSet } from '@ttt-productions/edge-protocol-core';
import { CurateProfanityListInputSchema } from '../src/schemas/utility';

// A curated word list is published under edge-protocol-core's `hashStringSet`, which refuses a
// value holding a line break (it joins values with one). A term with a line break must be refused
// where it enters, or every later word-list publish throws.
describe('CurateProfanityListInputSchema terms', () => {
  it('accepts ordinary terms to add and remove', () => {
    expect(CurateProfanityListInputSchema.safeParse({ add: ['slur'], remove: ['other'] }).success).toBe(true);
  });

  for (const lineBreak of [0x0a, 0x0d, 0x2028, 0x2029].map((code) => String.fromCharCode(code))) {
    const term = `bad${lineBreak}word`;
    it(`refuses a term holding the line break U+${lineBreak.charCodeAt(0).toString(16).padStart(4, '0')}`, () => {
      expect(CurateProfanityListInputSchema.safeParse({ add: [term] }).success).toBe(false);
      expect(CurateProfanityListInputSchema.safeParse({ remove: [term] }).success).toBe(false);
    });
  }

  it('lets through only terms the publish hash accepts', async () => {
    const parsed = CurateProfanityListInputSchema.parse({ add: ['one', 'two words'] });
    await expect(hashStringSet(parsed.add ?? [])).resolves.toMatch(/^[0-9a-f]{64}$/);
    await expect(hashStringSet(['bad\nword'])).rejects.toThrow(RangeError);
  });
});
