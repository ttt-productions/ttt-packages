export const SHORT_LINK_ID_LENGTH = 6;

// No 0/O or 1/I/l: a short id is read off a screen and typed by hand.
export const SHORT_LINK_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export const SHORT_LINK_ID_MAX_ATTEMPTS = 5;

export type RandomBytes = (count: number) => Uint8Array;

const secureRandomBytes: RandomBytes = (count) =>
  globalThis.crypto.getRandomValues(new Uint8Array(count));

// The largest multiple of the alphabet's length a byte can hold; a byte at or above it is drawn
// again, so every character is equally likely.
const UNBIASED_BYTE_LIMIT = 256 - (256 % SHORT_LINK_ID_ALPHABET.length);

export function generateShortLinkId(randomBytes: RandomBytes = secureRandomBytes): string {
  let id = '';
  while (id.length < SHORT_LINK_ID_LENGTH) {
    for (const byte of randomBytes(SHORT_LINK_ID_LENGTH)) {
      if (byte >= UNBIASED_BYTE_LIMIT) continue;
      id += SHORT_LINK_ID_ALPHABET.charAt(byte % SHORT_LINK_ID_ALPHABET.length);
      if (id.length === SHORT_LINK_ID_LENGTH) break;
    }
  }
  return id;
}
