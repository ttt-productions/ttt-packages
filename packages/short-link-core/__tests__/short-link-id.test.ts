import { describe, expect, it } from 'vitest';
import {
  SHORT_LINK_ID_ALPHABET,
  SHORT_LINK_ID_LENGTH,
  generateShortLinkId,
} from '../src/short-link-id.js';
import { shortLinkIdSchema } from '../src/short-link-schema.js';

describe('generateShortLinkId', () => {
  it('draws a full-length id from the alphabet with the secure random source', () => {
    for (let i = 0; i < 200; i++) {
      const id = generateShortLinkId();
      expect(id).toHaveLength(SHORT_LINK_ID_LENGTH);
      expect([...id].every((char) => SHORT_LINK_ID_ALPHABET.includes(char))).toBe(true);
      expect(shortLinkIdSchema.safeParse(id).success).toBe(true);
    }
  });

  it('maps each byte onto the alphabet by its remainder', () => {
    const bytes = [0, 1, SHORT_LINK_ID_ALPHABET.length, 2, 3, 4];
    expect(generateShortLinkId(() => Uint8Array.from(bytes))).toBe(
      `${SHORT_LINK_ID_ALPHABET[0]}${SHORT_LINK_ID_ALPHABET[1]}${SHORT_LINK_ID_ALPHABET[0]}${SHORT_LINK_ID_ALPHABET[2]}${SHORT_LINK_ID_ALPHABET[3]}${SHORT_LINK_ID_ALPHABET[4]}`,
    );
  });

  it('draws again for a byte past the last whole alphabet cycle, so no character is favoured', () => {
    const limit = 256 - (256 % SHORT_LINK_ID_ALPHABET.length);
    const draws = [Uint8Array.from([limit, 255, 0, 0, 0, 0]), Uint8Array.from([1, 1, 1, 1, 1, 1])];
    let call = 0;
    const id = generateShortLinkId(() => draws[call++]!);
    expect(id).toBe(`${'A'.repeat(4)}BB`);
    expect(call).toBe(2);
  });
});

describe('shortLinkIdSchema', () => {
  it('refuses an id of the wrong length or with a look-alike character', () => {
    expect(shortLinkIdSchema.safeParse('ABCDE').success).toBe(false);
    expect(shortLinkIdSchema.safeParse('ABCDEFG').success).toBe(false);
    expect(shortLinkIdSchema.safeParse('ABCDE0').success).toBe(false);
    expect(shortLinkIdSchema.safeParse('ABC/EF').success).toBe(false);
  });
});
